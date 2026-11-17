"""As travas da resposta automática do direct.

Cada teste aqui corresponde a uma forma de a resposta automática envergonhar a
empresa, e nenhuma delas é hipotética:

- responder ao próprio eco do webhook põe a conta conversando consigo mesma em
  laço até a Meta bloquear;
- responder toda mensagem transforma qualquer conversa em pingue-pongue com a
  máquina, inclusive no meio de uma negociação;
- responder duas vezes a mesma pessoa é pior do que não responder;
- uma falha na detecção sem teto vira mil mensagens antes de alguém perceber;
- e ligada por engano, ela fala com os clientes sem ninguém ter decidido isso.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from app.services import instagram_dm_service as dm

MEU_ID = "17841475508550943"
OUTRO = "998877"

LIGADA = {
    "enabled": True,
    "text": "Oi! Recebemos sua mensagem.",
    "only_off_hours": False,
    "hour_start": "08:00",
    "hour_end": "18:00",
    "daily_cap": dm.AUTOREPLY_DAILY_CAP,
}


class _relogio:
    """Um `datetime` com a hora presa, para a janela ser testável.

    Só `now` muda; o resto delega, porque o módulo usa a classe para outras
    coisas e substituí-la por um objeto simples quebraria o que não é o alvo.
    """

    def __init__(self, hhmm: str) -> None:
        hora, minuto = (int(parte) for parte in hhmm.split(":"))
        self._hora, self._minuto = hora, minuto

    def now(self, tz=None):
        from datetime import datetime as _dt
        base = _dt.now(tz)
        return base.replace(hour=self._hora, minute=self._minuto)

    def __getattr__(self, nome):
        from datetime import datetime as _dt
        return getattr(_dt, nome)


def _decidir(**mudancas):
    """Roda a decisão com tudo favorável, menos o que o teste mudar."""
    caso = {
        "conversation_id": "conv-1",
        "sender_id": OUTRO,
        "text": "Oi, queria saber sobre ponto facial",
        "ja_houve_contato": False,
        "enviadas_hoje": 0,
    }
    caso.update(mudancas)
    config = caso.pop("config", LIGADA)
    with patch.object(dm, "credentials", new=AsyncMock(return_value=("tok", MEU_ID))):
        with patch.object(dm, "autoreply_config", new=AsyncMock(return_value=config)):
            return asyncio.run(dm.should_autoreply(**caso))


class TravasTests(unittest.TestCase):
    def test_responde_o_primeiro_contato(self):
        self.assertEqual(_decidir(), "Oi! Recebemos sua mensagem.")

    def test_nunca_responde_a_si_mesma(self):
        """O webhook entrega eco das mensagens que a própria conta envia. Sem
        esta trava, a resposta automática responde a própria resposta."""
        self.assertEqual(_decidir(sender_id=MEU_ID), "")

    def test_nao_responde_quem_ja_conversou(self):
        self.assertEqual(_decidir(ja_houve_contato=True), "")

    def test_nao_responde_mensagem_vazia(self):
        """Figurinha e foto chegam sem texto. Responder a elas com o texto de
        boas-vindas é responder a nada."""
        self.assertEqual(_decidir(text="   "), "")
        self.assertEqual(_decidir(text=""), "")

    def test_teto_diario_segura_a_falha(self):
        self.assertEqual(_decidir(enviadas_hoje=dm.AUTOREPLY_DAILY_CAP), "")
        self.assertNotEqual(_decidir(enviadas_hoje=dm.AUTOREPLY_DAILY_CAP - 1), "")

    def test_desligada_nao_responde(self):
        self.assertEqual(_decidir(config={**LIGADA, "enabled": False}), "")

    def test_sem_remetente_nao_responde(self):
        self.assertEqual(_decidir(sender_id=""), "")


class HorarioTests(unittest.TestCase):
    """A janela comercial, incluindo a que cruza a meia-noite."""

    def test_janela_comum(self):
        self.assertTrue(dm._dentro_do_horario("10:00", "08:00", "18:00"))
        self.assertFalse(dm._dentro_do_horario("07:59", "08:00", "18:00"))
        self.assertFalse(dm._dentro_do_horario("18:00", "08:00", "18:00"))

    def test_janela_que_cruza_a_meia_noite(self):
        """Operação noturna existe. Sem este caso, 22:00 às 06:00 daria 'fora do
        horário' o tempo todo e a resposta automática responderia sempre."""
        self.assertTrue(dm._dentro_do_horario("23:30", "22:00", "06:00"))
        self.assertTrue(dm._dentro_do_horario("02:00", "22:00", "06:00"))
        self.assertFalse(dm._dentro_do_horario("12:00", "22:00", "06:00"))

    def test_so_fora_do_horario_cala_durante_o_expediente(self):
        config = {**LIGADA, "only_off_hours": True, "hour_start": "00:00", "hour_end": "23:59"}
        self.assertEqual(_decidir(config=config), "")

    def test_so_fora_do_horario_responde_fora_dele(self):
        """Com o relógio preso às 22h e expediente até as 18h, responde.

        A primeira versão deste teste dependia da hora real da máquina e
        terminava num assert que não podia falhar, o que é pior do que não ter
        teste: ele passa verde para sempre, inclusive quando a regra quebra."""
        config = {**LIGADA, "only_off_hours": True, "hour_start": "08:00", "hour_end": "18:00"}
        with patch.object(dm, "datetime", _relogio("22:00")):
            self.assertEqual(_decidir(config=config), "Oi! Recebemos sua mensagem.")

    def test_so_fora_do_horario_cala_as_dez_da_manha(self):
        config = {**LIGADA, "only_off_hours": True, "hour_start": "08:00", "hour_end": "18:00"}
        with patch.object(dm, "datetime", _relogio("10:00")):
            self.assertEqual(_decidir(config=config), "")


class ConfiguracaoTests(unittest.TestCase):
    def test_ligar_sem_texto_e_recusado(self):
        """Ligada e sem mensagem, ela enviaria string vazia para o cliente."""
        with patch.object(dm.token_store, "asave", new=AsyncMock()):
            with self.assertRaises(Exception) as caixa:
                asyncio.run(dm.save_autoreply_config(True, "   ", False, "08:00", "18:00"))
        self.assertIn("Escreva a mensagem", str(getattr(caixa.exception, "detail", "")))

    def test_desligar_sem_texto_e_permitido(self):
        with patch.object(dm.token_store, "asave", new=AsyncMock()):
            with patch.object(dm, "autoreply_config", new=AsyncMock(return_value=LIGADA)):
                asyncio.run(dm.save_autoreply_config(False, "", False, "08:00", "18:00"))

    def test_texto_e_limitado_e_normalizado(self):
        salvo = {}

        async def _captura(dados):
            salvo.update(dados)

        with patch.object(dm.token_store, "asave", new=_captura):
            with patch.object(dm, "autoreply_config", new=AsyncMock(return_value=LIGADA)):
                asyncio.run(dm.save_autoreply_config(True, "  oi\n\n   tudo   bem  ", False, "08:00", "18:00"))
        self.assertEqual(salvo["instagram_login_autoreply_text"], "oi tudo bem")


if __name__ == "__main__":
    unittest.main()
