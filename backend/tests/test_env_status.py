import unittest
from unittest.mock import patch

from app.services import env_status_service
from app.services.env_status_service import env_status


class EnvStatusTests(unittest.TestCase):
    """O contrato desta tela e simples e precisa continuar valendo: ela diz o que
    falta, nunca o valor, e sabe que algumas capacidades tem mais de um caminho."""

    def _with(self, **values):
        class FakeSettings:
            def __init__(self, data):
                self._data = data

            def __getattr__(self, name):
                return self._data.get(name, "")

        return patch.object(env_status_service, "settings", FakeSettings({k.lower(): v for k, v in values.items()}))

    def test_never_returns_a_value(self):
        with self._with(GROQ_API_KEY="gsk_segredo_de_verdade", APP_ENV="development"):
            payload = env_status()
        self.assertNotIn("gsk_segredo_de_verdade", str(payload))

    def test_image_group_accepts_either_provider(self):
        with self._with(APP_ENV="development", OPENROUTER_API_KEY="sk-or-xxx"):
            grupo = next(g for g in env_status()["groups"] if g["key"] == "ia_imagem")
        self.assertTrue(grupo["ready"], "OpenRouter sozinho ja atende a geracao de imagem")

        with self._with(APP_ENV="development", CLOUDFLARE_ACCOUNT_ID="abc", CLOUDFLARE_API_TOKEN="tok"):
            grupo = next(g for g in env_status()["groups"] if g["key"] == "ia_imagem")
        self.assertTrue(grupo["ready"], "Cloudflare sozinha tambem atende")

    def test_placeholder_from_vercel_pull_does_not_count_as_filled(self):
        """O `vercel env pull` grava [SENSITIVE] no lugar do valor. Tratar isso como
        preenchido faria a tela dizer que esta tudo certo com o .env inutil."""
        with self._with(APP_ENV="development", ASAAS_API_KEY="[SENSITIVE]"):
            grupo = next(g for g in env_status()["groups"] if g["key"] == "financeiro")
        self.assertFalse(grupo["ready"])
        self.assertIn("ASAAS_API_KEY", grupo["missing"])

    def test_default_secret_key_does_not_count_as_configured(self):
        with self._with(APP_ENV="development", SECRET_KEY="change-me", DATABASE_URL="sqlite://"):
            grupo = next(g for g in env_status()["groups"] if g["key"] == "app")
        self.assertFalse(grupo["ready"])

    def test_meta_read_is_independent_from_the_oauth_app(self):
        """Ler o Instagram nao depende de META_APP_ID: so o botao de conectar depende."""
        with self._with(APP_ENV="development", META_PAGE_ID="123", META_PAGE_ACCESS_TOKEN="tok"):
            groups = {g["key"]: g for g in env_status()["groups"]}
        self.assertTrue(groups["meta_read"]["ready"])
        self.assertFalse(groups["meta_app"]["ready"])

    def test_environment_drives_where_to_fix(self):
        with self._with(APP_ENV="production"):
            self.assertTrue(env_status()["is_production"])
        with self._with(APP_ENV="development"):
            self.assertFalse(env_status()["is_production"])


if __name__ == "__main__":
    unittest.main()
