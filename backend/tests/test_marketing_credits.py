"""O saldo do OpenRouter e a conta de quantas artes ele ainda paga.

Essa conta deu errado duas vezes antes de ficar de pé, sempre pelo mesmo motivo:
dividir o saldo por uma base que não é o que o OpenRouter cobra.

Primeiro usou o custo total por peça do painel, que inclui os agentes de texto
rodando no Groq de graça e, pior, dividia o custo dos últimos 90 dias por todas
as peças que já existiram. Depois usou a média de todas as artes, que inclui as
que saíram sem custo na franquia da Cloudflare. As duas versões devolveram
números oito vezes otimistas, e saldo otimista é o tipo de erro que só aparece
quando a conta já acabou no meio de uma rodada.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database.session import Base
from app.models.marketing import MarketingAgentStep
from app.routes.marketing_agent import credits
from app.services import marketing_agent_cost as custo


def _session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def _step(db: Session, **campos) -> None:
    base = {"run_id": 1, "agent": "ilustrador", "sequence": 1, "status": "done"}
    db.add(MarketingAgentStep(**{**base, **campos}))
    db.commit()


class CreditsTests(unittest.TestCase):
    def setUp(self):
        self.db = _session()
        self.addCleanup(self.db.close)

    def _saldo(self, balance=4.9208, total=5.0, used=0.0792):
        return {"configured": True, "total_usd": total, "used_usd": used, "balance_usd": balance}

    def test_divide_pelo_custo_real_da_arte_no_openrouter(self):
        # Duas artes pagas no OpenRouter a 0,0396 cada.
        _step(self.db, provider="openrouter", model="flux", images=1, cost_usd=0.0396, cost_measured=True)
        _step(self.db, provider="openrouter", model="flux", images=1, cost_usd=0.0396, cost_measured=True)

        with patch("app.routes.marketing_agent.openrouter_credits", new=AsyncMock(return_value=self._saldo())):
            resultado = asyncio.run(credits(self.db))

        self.assertTrue(resultado["cost_measured"])
        self.assertAlmostEqual(resultado["cost_per_content_usd"], 0.0396, places=4)
        self.assertEqual(resultado["posts_left"], 124)

    def test_arte_gratuita_da_cloudflare_nao_entra_na_media(self):
        # Se a arte da Cloudflare entrasse, a média cairia para metade e a conta
        # prometeria o dobro de artes do que o saldo paga.
        _step(self.db, provider="openrouter", model="flux", images=1, cost_usd=0.04, cost_measured=True)
        _step(self.db, provider="cloudflare", model="@cf/flux", images=1, cost_usd=0.0)

        with patch("app.routes.marketing_agent.openrouter_credits", new=AsyncMock(return_value=self._saldo(balance=4.0))):
            resultado = asyncio.run(credits(self.db))

        self.assertAlmostEqual(resultado["cost_per_content_usd"], 0.04, places=4)
        self.assertEqual(resultado["posts_left"], 100)

    def test_passo_de_texto_nao_entra_na_media(self):
        _step(self.db, provider="openrouter", model="flux", images=1, cost_usd=0.04, cost_measured=True)
        _step(self.db, agent="redator", provider="groq", model="llama", images=0, cost_usd=0.0)
        _step(self.db, agent="revisor_texto", provider="openrouter", model="texto", images=0, cost_usd=0.002)

        with patch("app.routes.marketing_agent.openrouter_credits", new=AsyncMock(return_value=self._saldo(balance=4.0))):
            resultado = asyncio.run(credits(self.db))

        self.assertAlmostEqual(resultado["cost_per_content_usd"], 0.04, places=4)
        self.assertEqual(resultado["posts_left"], 100)

    def test_sem_historico_cai_na_tabela_de_precos(self):
        with patch("app.routes.marketing_agent.openrouter_credits", new=AsyncMock(return_value=self._saldo(balance=1.0))):
            with patch("app.routes.marketing_agent.image_price_usd", return_value=0.0145):
                resultado = asyncio.run(credits(self.db))

        self.assertFalse(resultado["cost_measured"])
        self.assertEqual(resultado["posts_left"], 68)

    def test_sem_chave_devolve_apenas_nao_configurado(self):
        with patch("app.routes.marketing_agent.openrouter_credits", new=AsyncMock(return_value={"configured": False})):
            resultado = asyncio.run(credits(self.db))

        self.assertEqual(resultado, {"configured": False})
        self.assertNotIn("posts_left", resultado)

    def test_erro_do_openrouter_nao_vira_conta_com_saldo_zero(self):
        """Erro tem de chegar como erro na tela, e não como "dá para 0 peças"."""
        falha = {"configured": True, "error": "Não foi possível falar com o OpenRouter agora."}
        with patch("app.routes.marketing_agent.openrouter_credits", new=AsyncMock(return_value=falha)):
            resultado = asyncio.run(credits(self.db))

        self.assertEqual(resultado, falha)
        self.assertNotIn("posts_left", resultado)


# O cliente real, guardado antes do patch: sem isso a fabrica abaixo chamaria o
# proprio patch e a montagem do cliente entraria em recursao.
_CLIENTE_REAL = httpx.AsyncClient


class SaldoTests(unittest.TestCase):
    def _cliente(self, status_code: int, payload: dict | None = None):
        def transporte(request: httpx.Request) -> httpx.Response:
            return httpx.Response(status_code, json=payload or {})

        def fabrica(*args, **kwargs):
            kwargs.pop("timeout", None)
            return _CLIENTE_REAL(transport=httpx.MockTransport(transporte), **kwargs)

        return fabrica

    def test_saldo_e_a_diferenca_entre_comprado_e_usado(self):
        corpo = {"data": {"total_credits": 5.0, "total_usage": 0.0792}}
        with patch("httpx.AsyncClient", self._cliente(200, corpo)):
            with patch("app.core.config.settings.openrouter_api_key", "sk-or-teste"):
                resultado = asyncio.run(custo.openrouter_credits())

        self.assertEqual(resultado["balance_usd"], 4.9208)

    def test_saldo_nunca_fica_negativo(self):
        """A Meta e o OpenRouter já devolveram uso acima do comprado em conta com
        crédito promocional expirado. Saldo negativo na tela não ajuda ninguém."""
        corpo = {"data": {"total_credits": 1.0, "total_usage": 1.5}}
        with patch("httpx.AsyncClient", self._cliente(200, corpo)):
            with patch("app.core.config.settings.openrouter_api_key", "sk-or-teste"):
                resultado = asyncio.run(custo.openrouter_credits())

        self.assertEqual(resultado["balance_usd"], 0.0)

    def test_chave_recusada_vira_frase_e_nao_excecao(self):
        with patch("httpx.AsyncClient", self._cliente(401)):
            with patch("app.core.config.settings.openrouter_api_key", "sk-or-ruim"):
                resultado = asyncio.run(custo.openrouter_credits())

        self.assertIn("OPENROUTER_API_KEY", resultado["error"])

    def test_sem_chave_nao_chama_a_rede(self):
        with patch("app.core.config.settings.openrouter_api_key", ""):
            resultado = asyncio.run(custo.openrouter_credits())

        self.assertEqual(resultado, {"configured": False})


if __name__ == "__main__":
    unittest.main()
