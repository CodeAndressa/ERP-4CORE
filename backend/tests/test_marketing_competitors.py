import unittest

import httpx
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.session import Base
from app.models.marketing import CompetitorPost, CompetitorSnapshot, MarketingCompetitor
from app.services.instagram_dm_service import dm_error_detail
from app.services.meta_marketing_service import _business_discovery_error
from app.services.marketing_competitor_service import (
    add_competitor,
    competitor_profile,
    normalize_username,
)


def _session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


class NormalizeUsernameTests(unittest.TestCase):
    def test_accepts_handle_with_or_without_arroba(self):
        self.assertEqual(normalize_username("@4CoreConsultoria"), "4coreconsultoria")
        self.assertEqual(normalize_username(" 4core.consultoria "), "4core.consultoria")

    def test_rejects_url_and_spaces(self):
        for value in ("https://instagram.com/fulano", "dois nomes", "", "@"):
            with self.assertRaises(HTTPException):
                normalize_username(value)


class CompetitorProfileTests(unittest.TestCase):
    def setUp(self):
        self.db = _session()
        self.competitor = add_competitor(self.db, "@concorrente")
        self.competitor.followers_count = 1000
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _post(self, days_ago: int, likes: int, comments: int, caption: str = "") -> None:
        self.db.add(
            CompetitorPost(
                competitor_id=self.competitor.id,
                media_id=f"m{days_ago}-{likes}",
                media_type="IMAGE",
                caption=caption,
                like_count=likes,
                comments_count=comments,
                posted_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
            )
        )
        self.db.commit()

    def test_engagement_rate_uses_followers_as_base(self):
        self._post(1, 40, 10)
        self._post(2, 60, 10)
        profile = competitor_profile(self.db, self.competitor)
        # media de 50 curtidas + 10 comentarios sobre 1000 seguidores = 6%
        self.assertEqual(profile["avg_likes"], 50.0)
        self.assertEqual(profile["engagement_rate"], 6.0)
        self.assertEqual(profile["posts_analyzed"], 2)

    def test_cadence_is_normalized_to_a_week(self):
        for day in range(1, 9):
            self._post(day, 10, 0)
        profile = competitor_profile(self.db, self.competitor, window_days=28)
        self.assertEqual(profile["posts_per_week"], 2.0)

    def test_silent_profile_reports_zero_cadence(self):
        """Perfil parado ha 120 dias tem cadencia zero. A versao anterior caia para o
        historico inteiro e dividia por 30, dizendo que uma conta parada publicava
        toda semana, que e o oposto do que aconteceu."""
        self._post(120, 30, 0)
        profile = competitor_profile(self.db, self.competitor, window_days=30)
        self.assertEqual(profile["posts_analyzed"], 0)
        self.assertEqual(profile["posts_per_week"], 0.0)
        self.assertTrue(profile["is_silent"])
        self.assertEqual(profile["days_since_last_post"], 120)

    def test_silent_profile_still_reports_engagement_as_history(self):
        """Sem nada na janela, o engajamento vem do historico e vai marcado como tal,
        para a tela nao apresentar desempenho antigo como atual."""
        self._post(120, 30, 0)
        profile = competitor_profile(self.db, self.competitor, window_days=30)
        self.assertTrue(profile["engagement_from_history"])
        self.assertEqual(profile["engagement_rate"], 3.0)

    def test_active_profile_is_not_marked_as_history(self):
        self._post(2, 40, 10)
        self._post(5, 60, 10)
        profile = competitor_profile(self.db, self.competitor, window_days=30)
        self.assertEqual(profile["posts_analyzed"], 2)
        self.assertFalse(profile["engagement_from_history"])
        self.assertFalse(profile["is_silent"])

    def test_growth_needs_two_snapshots(self):
        self._post(1, 10, 0)
        self.db.add(CompetitorSnapshot(competitor_id=self.competitor.id, followers_count=900))
        self.db.commit()
        self.assertFalse(competitor_profile(self.db, self.competitor)["growth_measured"])

        self.db.add(CompetitorSnapshot(competitor_id=self.competitor.id, followers_count=990))
        self.db.commit()
        profile = competitor_profile(self.db, self.competitor)
        self.assertTrue(profile["growth_measured"])
        self.assertEqual(profile["followers_gained"], 90)
        self.assertEqual(profile["followers_growth_pct"], 10.0)

    def test_hashtags_are_counted_from_captions(self):
        self._post(1, 10, 0, "Gestao que funciona #consultoria #gestao")
        self._post(2, 10, 0, "Processo enxuto #consultoria")
        profile = competitor_profile(self.db, self.competitor)
        self.assertEqual(profile["top_hashtags"][0], "#consultoria")

    def test_duplicate_username_is_rejected(self):
        with self.assertRaises(HTTPException):
            add_competitor(self.db, "concorrente")


class CompetitorModelTests(unittest.TestCase):
    def test_competitor_starts_active_and_unsynced(self):
        db = _session()
        competitor = add_competitor(db, "novo.perfil", display_name="Novo")
        stored = db.query(MarketingCompetitor).one()
        self.assertTrue(stored.active)
        self.assertIsNone(stored.last_synced_at)
        self.assertEqual(competitor.display_name, "Novo")
        db.close()


class BusinessDiscoveryErrorTests(unittest.TestCase):
    """A mensagem precisa dizer o que fazer. Mandar "tente de novo" num @ que nao
    existe fez perder tempo conferindo 31 handles do setor em 16/11/2026."""

    @staticmethod
    def _resposta(status: int, error: dict) -> httpx.Response:
        return httpx.Response(status, json={"error": error})

    def test_handle_inexistente_nao_pede_para_tentar_de_novo(self):
        # Resposta real da Meta para um @ que nao existe.
        mensagem = _business_discovery_error(
            self._resposta(
                400,
                {
                    "message": "Invalid user id",
                    "type": "OAuthException",
                    "code": 110,
                    "error_subcode": 2207013,
                    "is_transient": False,
                    "error_user_msg": (
                        "Nao foi possivel encontrar o usuario com o nome de usuario topdata."
                    ),
                },
            ),
            "topdata",
        )
        self.assertIn("@topdata", mensagem)
        self.assertIn("Comercial ou Criador de conteudo", mensagem)
        self.assertNotIn("instantes", mensagem)

    def test_subcode_sozinho_ja_identifica_handle_invalido(self):
        mensagem = _business_discovery_error(
            self._resposta(400, {"message": "texto novo da Meta", "error_subcode": 2207013}),
            "fulano",
        )
        self.assertIn("tentar de novo nao resolve", mensagem)

    def test_permissao_perdida_manda_reconectar(self):
        mensagem = _business_discovery_error(
            self._resposta(400, {"message": "Missing permission instagram_basic"}),
            "fulano",
        )
        self.assertIn("Reconecte", mensagem)

    def test_limite_de_chamadas_fala_de_limite(self):
        mensagem = _business_discovery_error(self._resposta(429, {"message": "rate limited"}), "x")
        self.assertIn("limite de chamadas", mensagem)

    def test_erro_desconhecido_prefere_o_texto_pronto_da_meta(self):
        mensagem = _business_discovery_error(
            self._resposta(500, {"message": "algo novo", "error_user_msg": "Tente mais tarde."}),
            "fulano",
        )
        self.assertEqual(mensagem, "Tente mais tarde.")

    def test_erro_sem_corpo_cai_no_generico(self):
        mensagem = _business_discovery_error(httpx.Response(500, text="nao e json"), "fulano")
        self.assertIn("Tente novamente em instantes", mensagem)


class ErroDasMensagensTests(unittest.TestCase):
    """A tela mostrava o JSON cru da Meta, com OAuthException e data em PST. O caso
    mais comum e o token de 60 dias que venceu sem ninguem perceber."""

    @staticmethod
    def _resposta(error: dict) -> httpx.Response:
        return httpx.Response(400, json={"error": error})

    def test_token_vencido_diz_o_que_fazer_e_quando_venceu(self):
        mensagem = dm_error_detail(
            self._resposta({
                "message": (
                    "Error validating access token: Session has expired on Monday, "
                    "09-Nov-26 06:47:44 PST. The current time is Monday, 16-Nov-26 07:36:48 PST."
                ),
                "type": "OAuthException",
                "code": 190,
            }),
            "listar as conversas",
        )
        self.assertIn("expirou", mensagem)
        self.assertIn("09-Nov-26", mensagem)
        self.assertIn("Conexoes", mensagem)
        # Nada de vocabulario da Meta na tela.
        self.assertNotIn("OAuthException", mensagem)
        self.assertNotIn("PST", mensagem)

    def test_limite_de_chamadas_pede_para_esperar(self):
        mensagem = dm_error_detail(self._resposta({"message": "too many calls", "code": 4}), "x")
        self.assertIn("limitou as chamadas", mensagem)

    def test_permissao_perdida_manda_reconectar(self):
        mensagem = dm_error_detail(self._resposta({"message": "missing permission", "code": 10}), "x")
        self.assertIn("Reconecte", mensagem)

    def test_erro_desconhecido_mostra_a_meta_sem_json(self):
        mensagem = dm_error_detail(self._resposta({"message": "algo novo"}), "enviar a resposta")
        self.assertIn("enviar a resposta", mensagem)
        self.assertIn("algo novo", mensagem)

    def test_resposta_sem_json_nao_quebra(self):
        self.assertIn("Nao foi possivel", dm_error_detail(httpx.Response(500, text="<html>"), "x"))


if __name__ == "__main__":
    unittest.main()
