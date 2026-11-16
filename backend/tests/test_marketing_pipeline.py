import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.session import Base
from app.models.marketing import MarketingAgentRun, MarketingAgentStep, MarketingContent
import httpx

from app.services import marketing_agent_llm as llm
from app.services import marketing_agent_service as pipeline
from app.services.marketing_agent_cost import Usage, image_usage, text_usage, total
from app.services.marketing_schedule_service import BRAZIL_TZ, best_hour, next_slots


def _session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


class CostTests(unittest.TestCase):
    def test_openrouter_reported_cost_is_used_as_measured(self):
        usage = text_usage("openrouter", "qualquer/modelo", {"usage": {"prompt_tokens": 100, "completion_tokens": 50, "cost": 0.0042}})
        self.assertTrue(usage.measured)
        self.assertEqual(usage.cost_usd, 0.0042)

    def test_groq_cost_is_estimated_from_token_table(self):
        usage = text_usage("groq", "openai/gpt-oss-120b", {"usage": {"prompt_tokens": 1_000_000, "completion_tokens": 0}})
        self.assertFalse(usage.measured)
        self.assertAlmostEqual(usage.cost_usd, 0.15, places=6)

    def test_cloudflare_image_is_free_within_allowance(self):
        usage = image_usage("cloudflare", "@cf/black-forest-labs/flux-2-klein-4b")
        self.assertEqual(usage.cost_usd, 0.0)
        self.assertIn("franquia", usage.notes)

    def test_total_flags_estimate_when_any_part_is_estimated(self):
        medido = Usage("openrouter", "m", cost_usd=0.01, measured=True)
        estimado = Usage("groq", "g", cost_usd=0.002, measured=False)
        self.assertTrue(total([medido])["fully_measured"])
        self.assertFalse(total([medido, estimado])["fully_measured"])
        self.assertAlmostEqual(total([medido, estimado])["cost_usd"], 0.012, places=6)


class BestHourTests(unittest.TestCase):
    def _post(self, hour: int, likes: int):
        moment = datetime(2026, 10, 5, hour, 0, tzinfo=BRAZIL_TZ).astimezone(timezone.utc)
        return {"posted_at": moment, "like_count": likes, "comments_count": 0}

    def test_falls_back_to_default_without_enough_history(self):
        result = best_hour([self._post(14, 100)])
        self.assertFalse(result["measured"])
        self.assertEqual(result["hour"], 9)

    def test_uses_average_so_volume_does_not_win(self):
        """Seis posts medianos as 10h nao podem ganhar de dois otimos as 19h."""
        posts = [self._post(10, 10) for _ in range(6)] + [self._post(19, 400) for _ in range(2)]
        result = best_hour(posts)
        self.assertTrue(result["measured"])
        self.assertEqual(result["hour"], 19)


class NextSlotsTests(unittest.TestCase):
    def setUp(self):
        self.db = _session()

    def tearDown(self):
        self.db.close()

    def test_respects_cadence_and_skips_weekend(self):
        now = datetime(2026, 11, 16, 8, 0, tzinfo=timezone.utc)  # segunda
        slots = next_slots(self.db, 3, hour=9, cadence_days=2, now=now)
        self.assertEqual(len(slots), 3)
        for slot in slots:
            self.assertIn(slot.weekday(), {0, 1, 2, 3, 4})
            self.assertEqual(slot.hour, 9)
        self.assertLess(slots[0], slots[1])

    def test_starts_after_what_is_already_scheduled(self):
        """Rodar duas vezes no mesmo dia nao pode marcar duas pecas para a mesma data."""
        future = datetime.now(timezone.utc) + timedelta(days=10)
        self.db.add(MarketingContent(title="Ja agendada", status="scheduled", scheduled_at=future))
        self.db.commit()
        slots = next_slots(self.db, 1, hour=9, cadence_days=2)
        self.assertGreater(slots[0], future)


class PipelineTests(unittest.TestCase):
    """A esteira inteira com os modelos trocados por respostas fixas: o que esta sendo
    verificado e a sequencia dos agentes, o registro de custo e o estado final da peca."""

    def setUp(self):
        self.db = _session()

    def tearDown(self):
        self.db.close()

    def _fake_ask_json(self, system_prompt, payload, action, temperature=0.5, timeout=90.0):
        usage = Usage("fake", "modelo-de-teste", 100, 50, cost_usd=0.001, measured=True)
        if "estrategista" in system_prompt or "comparativo" in system_prompt:
            return {
                "leitura": "A 4Core publica menos que a média observada.",
                "pontos_fortes": ["Legenda com voz técnica consistente"],
                "lacunas": ["Publica 1,2 vezes por semana contra 3,4 da média"],
                "recomendacoes": [{"acao": "Subir para 3 posts por semana", "motivo": "cadência abaixo do mercado"}],
                "pautas": [
                    {
                        "title": "Espelho de ponto sem assinatura",
                        "pillar": "conformidade",
                        "objective": "Mostrar o risco em ação trabalhista",
                        "brief": "Explicar por que o espelho sem assinatura enfraquece a prova.",
                        "por_que_agora": "Concorrentes engajam mais com tema de risco",
                    }
                ],
            }, usage
        if "revisor de texto" in system_prompt:
            return {
                "aprovado": False,
                "nota": 7,
                "problemas": ["Clichê de IA na abertura"],
                "headline_final": "Seu espelho de ponto prova alguma coisa?",
                "caption_final": "Legenda revisada, sem clichê, terminando em pergunta aberta.",
            }, usage
        if "diretor de arte" in system_prompt:
            return {
                "visual_concept": "HR manager reviewing timesheet on a tablet",
                "visual_constraints": "no analog clocks, no handshakes",
                "justificativa": "Cena coerente com o gancho",
            }, usage
        return {
            "headline": "Espelho de ponto sem assinatura",
            "caption": "Texto cru do redator.",
            "visual_concept": "office scene",
            "visual_constraints": "",
        }, usage

    async def _fake_generate_art(self, prompt, headline, layout="feed", product=None, fact=None, template=""):
        self.assertEqual(layout, "feed")
        self.ultimo_template = template
        # Layout montado no codigo nao chama modelo de imagem, entao nao tem consumo.
        if template in {"produto", "comparativo", "dado"}:
            return "supabase:gerada/montada.png", None
        return "supabase:gerada/teste.png", image_usage("openrouter", "black-forest-labs/flux.2-klein-4b", 1, 0.0145)

    def _run(self):
        benchmark = {
            "window_days": 30,
            "own": {"username": "4coreconsultoria", "recent_captions": [], "top_posts": []},
            "own_error": "",
            "competitors": [],
            "market": {"competitors_tracked": 2, "avg_engagement_rate": 2.1, "avg_posts_per_week": 3.4,
                       "own_position": 3, "ranking_size": 3, "engagement_gap": -0.8, "cadence_gap": -2.2},
        }
        with patch.object(pipeline, "sync_all", new=self._noop), \
             patch.object(pipeline, "build_benchmark", new=self._benchmark(benchmark)), \
             patch.object(pipeline, "ask_json", new=self._async(self._fake_ask_json)), \
             patch.object(pipeline, "has_text_model", return_value=True), \
             patch.object(pipeline, "learned_guidance", new=self._async_value({"copy": "", "image": ""})), \
             patch.object(pipeline, "generate_art_with_usage", new=self._fake_generate_art):
            return asyncio.run(pipeline.run_pipeline(self.db, content_limit=1, layout="feed"))

    @staticmethod
    def _async(fn):
        async def wrapper(*args, **kwargs):
            return fn(*args, **kwargs)
        return wrapper

    @staticmethod
    def _async_value(value):
        async def wrapper(*args, **kwargs):
            return value
        return wrapper

    @staticmethod
    def _noop(*args, **kwargs):
        async def inner():
            return []
        return inner()

    @staticmethod
    def _benchmark(value):
        async def wrapper(*args, **kwargs):
            return value
        return wrapper

    def test_pipeline_runs_every_agent_in_order(self):
        result = self._run()
        self.assertEqual(result["status"], "done")
        agents = [step["agent"] for step in result["steps"]]
        self.assertEqual(
            agents,
            [
                "analista",
                "estrategista",
                "diretor_criacao",
                "redator",
                "revisor_texto",
                "diretor_arte",
                "ilustrador",
                "agendador",
            ],
        )
        self.assertTrue(all(step["status"] == "done" for step in result["steps"]))

    def test_reviewer_text_replaces_the_writer_draft(self):
        """O que vai para a peca e a versao do revisor, nao a do redator."""
        self._run()
        content = self.db.query(MarketingContent).one()
        self.assertEqual(content.headline, "Seu espelho de ponto prova alguma coisa?")
        self.assertIn("revisada", content.caption)
        self.assertEqual(content.layout, "feed")

    def test_piece_waits_for_approval_and_is_scheduled(self):
        result = self._run()
        content = self.db.query(MarketingContent).one()
        self.assertEqual(content.status, "awaiting_approval")
        self.assertIsNotNone(content.scheduled_at)
        self.assertEqual(result["created"][0]["review"]["nota"], 7)

    def test_cost_is_recorded_per_step(self):
        result = self._run()
        steps = self.db.query(MarketingAgentStep).all()
        billed = [step for step in steps if step.cost_usd > 0]
        # estrategista, diretor de criacao, redator, revisor, diretor de arte e
        # ilustrador. O analista e o agendador nao chamam modelo.
        self.assertEqual(len(billed), 6)
        self.assertAlmostEqual(result["costs"]["cost_usd"], 0.001 * 5 + 0.0145, places=6)
        self.assertTrue(result["costs"]["fully_measured"])

    def test_pauta_sem_produto_nem_dado_cai_na_foto(self):
        # A pauta do duble fala de espelho de ponto sem casar dois termos de
        # produto nem de risco, entao sobra o layout gerado.
        self._run()
        self.assertEqual(self.ultimo_template, "foto")

    def test_agendamento_sai_em_utc(self):
        # O `process_due` compara com `datetime.now(timezone.utc)`. Guardar o
        # horario de Sao Paulo fazia a peca publicar 3h adiantada.
        self._run()
        content = self.db.query(MarketingContent).one()
        serializado = pipeline.created_from_run(
            self.db, self.db.query(MarketingAgentRun).one()
        )
        self.assertTrue(serializado[0]["scheduled_at"].endswith("+00:00"))
        # 9h em Sao Paulo e 12h em UTC: o valor guardado precisa ser o UTC.
        self.assertEqual(content.scheduled_at.hour, 12)

    def test_analysis_only_run_creates_no_content(self):
        with patch.object(pipeline, "sync_all", new=self._noop), \
             patch.object(pipeline, "build_benchmark", new=self._benchmark({
                 "window_days": 30, "own": {"username": "x", "recent_captions": [], "top_posts": []},
                 "own_error": "", "competitors": [],
                 "market": {"competitors_tracked": 0, "avg_engagement_rate": 0, "avg_posts_per_week": 0,
                            "own_position": None, "ranking_size": 0, "engagement_gap": 0, "cadence_gap": 0}})), \
             patch.object(pipeline, "ask_json", new=self._async(self._fake_ask_json)), \
             patch.object(pipeline, "has_text_model", return_value=True), \
             patch.object(pipeline, "learned_guidance", new=self._async_value({"copy": "", "image": ""})):
            result = asyncio.run(pipeline.run_pipeline(self.db, content_limit=0))
        self.assertEqual(self.db.query(MarketingContent).count(), 0)
        self.assertEqual([step["agent"] for step in result["steps"]], ["analista", "estrategista", "agendador"])


class RetryDoLimiteTests(unittest.TestCase):
    """O revisor de texto caia sempre no plano gratuito do Groq: o analista e o
    estrategista gastam a cota do minuto e ele chegava a poucos segundos da janela
    virar. Esperar e repetir e o que mantem a revisao acontecendo."""

    @staticmethod
    def _resposta(status: int, headers: dict | None = None) -> httpx.Response:
        return httpx.Response(status, headers=headers or {}, json={})

    def test_le_retry_after_em_segundos(self):
        r = self._resposta(429, {"retry-after": "12"})
        self.assertEqual(llm._retry_after_seconds(r), 12.0)

    def test_le_duracao_do_groq(self):
        casos = {"12.5s": 12.5, "1m30s": 90.0, "500ms": 0.5, "2m": 120.0}
        for texto, esperado in casos.items():
            r = self._resposta(429, {"x-ratelimit-reset-tokens": texto})
            self.assertAlmostEqual(llm._retry_after_seconds(r), esperado, places=3, msg=texto)

    def test_sem_cabecalho_nao_inventa_espera(self):
        self.assertIsNone(llm._retry_after_seconds(self._resposta(429)))

    def test_repete_depois_de_esperar_e_devolve_o_sucesso(self):
        respostas = [self._resposta(429, {"retry-after": "1"}), self._resposta(200)]
        dormiu: list[float] = []

        class ClienteFalso:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, *a, **k):
                return respostas.pop(0)

        async def dorme(s):
            dormiu.append(s)

        with patch.object(llm.httpx, "AsyncClient", lambda **k: ClienteFalso()),              patch.object(llm.asyncio, "sleep", dorme):
            r = asyncio.run(llm._post_with_retry("http://x", {}, {}, 10.0))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(dormiu), 1)
        self.assertGreaterEqual(dormiu[0], 1.0)

    def test_espera_longa_demais_nao_prende_a_tela(self):
        chamadas = []

        class ClienteFalso:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, *a, **k):
                chamadas.append(1)
                return httpx.Response(429, headers={"retry-after": "600"}, json={})

        with patch.object(llm.httpx, "AsyncClient", lambda **k: ClienteFalso()):
            r = asyncio.run(llm._post_with_retry("http://x", {}, {}, 10.0))
        self.assertEqual(r.status_code, 429)
        # Devolve na primeira: 600s passa do teto, nao adianta esperar.
        self.assertEqual(len(chamadas), 1)

    def test_sem_cabecalho_devolve_sem_dormir_no_escuro(self):
        class ClienteFalso:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, *a, **k):
                return httpx.Response(429, json={})

        with patch.object(llm.httpx, "AsyncClient", lambda **k: ClienteFalso()):
            r = asyncio.run(llm._post_with_retry("http://x", {}, {}, 10.0))
        self.assertEqual(r.status_code, 429)


class PecasDoHistoricoTests(unittest.TestCase):
    """Abrir uma rodada antiga precisa trazer as pecas dela. A lista rica so existe
    em memoria durante a rodada, entao o historico relê do banco pelos ids."""

    def setUp(self):
        self.db = _session()

    def tearDown(self):
        self.db.close()

    def _run(self, ids: str) -> MarketingAgentRun:
        run = MarketingAgentRun(status="done", trigger="manual", created_content_ids=ids)
        self.db.add(run)
        self.db.commit()
        return run

    def test_devolve_as_pecas_na_ordem_dos_ids(self):
        for titulo in ("Primeira", "Segunda"):
            self.db.add(MarketingContent(title=titulo, status="awaiting_approval"))
        self.db.commit()
        ids = [row.id for row in self.db.query(MarketingContent).all()]
        run = self._run(f"{ids[1]},{ids[0]}")
        saida = pipeline.created_from_run(self.db, run)
        self.assertEqual([item["content_id"] for item in saida], [ids[1], ids[0]])
        self.assertEqual(saida[0]["title"], "Segunda")

    def test_rodada_sem_peca_devolve_lista_vazia(self):
        self.assertEqual(pipeline.created_from_run(self.db, self._run("")), [])

    def test_peca_apagada_some_em_vez_de_virar_linha_vazia(self):
        self.db.add(MarketingContent(title="Viva", status="draft"))
        self.db.commit()
        vivo = self.db.query(MarketingContent).one().id
        run = self._run(f"{vivo},9999")
        saida = pipeline.created_from_run(self.db, run)
        self.assertEqual(len(saida), 1)
        self.assertEqual(saida[0]["content_id"], vivo)

    def test_id_invalido_nao_derruba_a_leitura(self):
        self.assertEqual(pipeline.created_from_run(self.db, self._run("abc,,  ")), [])



class EscolhaDeLayoutTests(unittest.TestCase):
    """O rodizio pelo id da peca e o que garante que duas pecas seguidas nao saiam
    com o mesmo layout, sem guardar estado novo no banco."""

    PRODUTO = {"name": "REP-P facial", "contraste": {"sem": ["x"], "com": ["y"]}}
    SEM_CONTRASTE = {"name": "Produto sem contraste"}
    FATO = {"numero": "R$ 6 mil"}

    def test_sem_nada_cai_na_foto(self):
        self.assertEqual(pipeline.choose_template(None, None, 0, True), "foto")

    def test_produto_com_contraste_e_cena_tem_tres_opcoes(self):
        vistos = {
            pipeline.choose_template(self.PRODUTO, None, seed, True) for seed in range(6)
        }
        self.assertEqual(vistos, {"produto", "comparativo", "cena"})

    def test_sem_provedor_de_cena_a_opcao_some(self):
        vistos = {
            pipeline.choose_template(self.PRODUTO, None, seed, False) for seed in range(6)
        }
        self.assertEqual(vistos, {"produto", "comparativo"})

    def test_produto_sem_contraste_nao_vira_comparativo(self):
        vistos = {
            pipeline.choose_template(self.SEM_CONTRASTE, None, seed, False) for seed in range(6)
        }
        self.assertEqual(vistos, {"produto"})

    def test_fato_de_risco_entra_como_peca_de_dado(self):
        self.assertEqual(pipeline.choose_template(None, self.FATO, 0, True), "dado")

    def test_pecas_seguidas_nao_repetem_o_layout(self):
        seguidas = [
            pipeline.choose_template(self.PRODUTO, self.FATO, pid, True) for pid in (10, 11, 12)
        ]
        self.assertEqual(len(set(seguidas)), 3, seguidas)


if __name__ == "__main__":
    unittest.main()
