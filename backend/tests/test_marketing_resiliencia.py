"""Dois pontos onde a esteira quebrava sem dizer a verdade sobre a causa.

Os dois foram encontrados rodando de verdade, não lendo código, e os dois têm a
mesma assinatura: a mensagem de erro aponta para o lugar errado.

1. A cerca de markdown em volta do JSON. `response_format: json_object` não é
   respeitado por todos os provedores, e os modelos da Anthropic via OpenRouter
   devolvem o JSON certo dentro de ```json ... ```. O `json.loads` morre no
   primeiro acento grave e a esteira diz "a IA devolveu um formato inválido", que
   culpa o modelo quando o problema era o parse. Isso derrubava a esteira inteira
   no momento em que o modelo de escrita fosse trocado, que é justamente a
   mudança que se faz para melhorar o texto.

2. O 9007 da Meta ao publicar. O contêiner informa FINISHED e a mídia ainda não
   está publicável; a Meta devolve "Media ID is not available" com
   `is_transient: false`, apesar de ser exatamente transitório. O story falhava, e
   o JSON cru da Meta ia para a tela de quem só queria publicar.
"""

import asyncio
import unittest
from unittest.mock import patch

import httpx

from app.services.marketing_agent_llm import _unfence
from app.services.meta_marketing_service import (
    MetaMarketingService,
    _publish_error_detail,
    PUBLISH_RETRY_WAITS,
)

NL = chr(10)


class CercaDeMarkdownTests(unittest.TestCase):
    def test_json_cercado_com_rotulo_de_linguagem(self):
        self.assertEqual(_unfence("```json" + NL + '{"a": 1}' + NL + "```"), '{"a": 1}')

    def test_json_cercado_sem_rotulo(self):
        self.assertEqual(_unfence("```" + NL + '{"a": 1}' + NL + "```"), '{"a": 1}')

    def test_json_limpo_passa_intacto(self):
        self.assertEqual(_unfence('{"a": 1}'), '{"a": 1}')

    def test_espaco_em_volta_da_cerca(self):
        self.assertEqual(_unfence("  ```json" + NL + '{"b": 2}' + NL + "```  "), '{"b": 2}')

    def test_cerca_sem_fechamento_devolve_o_que_tem(self):
        """Resposta truncada no meio não pode virar exceção aqui: quem trata
        JSON inválido é o chamador, com a mensagem dele."""
        self.assertEqual(_unfence("```json" + NL + '{"a": 1}'), '{"a": 1}')

    def test_cerca_vazia_e_nulo_nao_estouram(self):
        self.assertEqual(_unfence("```json"), "")
        self.assertEqual(_unfence(None), "")
        self.assertEqual(_unfence(""), "")


class PublicacaoTests(unittest.TestCase):
    """A publicação do contêiner, com a espera e a nova tentativa."""

    def setUp(self):
        # As esperas reais somam 21 segundos. O teste verifica a lógica da
        # tentativa, não a passagem do tempo.
        dormiu = patch("app.services.meta_marketing_service.asyncio.sleep", new=self._nada)
        dormiu.start()
        self.addCleanup(dormiu.stop)

    @staticmethod
    async def _nada(_segundos):
        return None

    def _cliente(self, respostas):
        """Um cliente que devolve as respostas em ordem, uma por chamada."""
        fila = list(respostas)
        self.chamadas = 0

        def transporte(request: httpx.Request) -> httpx.Response:
            self.chamadas += 1
            return fila.pop(0) if fila else httpx.Response(500)

        return httpx.AsyncClient(transport=httpx.MockTransport(transporte))

    def _publicar(self, respostas):
        servico = MetaMarketingService()

        async def main():
            async with self._cliente(respostas) as client:
                return await servico._publish_container(client, "ig", "tok", "cont", "o story")

        return asyncio.run(main())

    def _nao_pronto(self):
        return httpx.Response(
            400,
            json={
                "error": {
                    "message": "Media ID is not available",
                    "code": 9007,
                    "error_subcode": 2207027,
                    "is_transient": False,
                }
            },
        )

    def test_publica_de_primeira(self):
        media_id = self._publicar([httpx.Response(200, json={"id": "17900"})])
        self.assertEqual(media_id, "17900")
        self.assertEqual(self.chamadas, 1)

    def test_9007_tenta_de_novo_e_passa(self):
        """É o caso real: a Meta pede para aguardar, e aguardar resolve."""
        media_id = self._publicar([
            self._nao_pronto(),
            self._nao_pronto(),
            httpx.Response(200, json={"id": "17901"}),
        ])
        self.assertEqual(media_id, "17901")
        self.assertEqual(self.chamadas, 3)

    def test_9007_ate_o_fim_vira_frase_sem_json(self):
        with self.assertRaises(Exception) as caixa:
            self._publicar([self._nao_pronto() for _ in range(len(PUBLISH_RETRY_WAITS) + 1)])
        detalhe = str(getattr(caixa.exception, "detail", caixa.exception))
        self.assertIn("não liberou a mídia", detalhe)
        self.assertNotIn("error_subcode", detalhe)
        self.assertNotIn("OAuthException", detalhe)

    def test_erro_que_nao_passa_sozinho_nao_e_repetido(self):
        """Token expirado não melhora esperando: insistir só atrasa o aviso."""
        with self.assertRaises(Exception) as caixa:
            self._publicar([httpx.Response(400, json={"error": {"code": 190, "message": "expired"}})])
        self.assertEqual(self.chamadas, 1)
        self.assertIn("token da Página expirou", str(getattr(caixa.exception, "detail", "")))


class MensagemDeErroTests(unittest.TestCase):
    """Cada código pede uma ação diferente, e a frase tem de dizer qual."""

    def test_token_expirado_manda_para_conexoes(self):
        frase = _publish_error_detail({"code": 190}, "o story")
        self.assertIn("Conexões", frase)

    def test_imagem_inacessivel_fala_de_armazenamento(self):
        frase = _publish_error_detail({"code": 9004}, "a publicação")
        self.assertIn("URL pública", frase)

    def test_limite_diario_diz_que_a_peca_continua_aprovada(self):
        frase = _publish_error_detail({"code": 25002}, "a publicação")
        self.assertIn("continua aprovada", frase)

    def test_codigo_desconhecido_usa_a_mensagem_em_portugues_da_meta(self):
        """A Meta manda `error_user_msg` escrito para ser lido por pessoa. Era
        só usar, em vez de despejar o JSON inteiro na tela."""
        frase = _publish_error_detail(
            {"code": 12345, "message": "Unknown", "error_user_msg": "A conta está restrita."},
            "o story",
        )
        self.assertIn("A conta está restrita.", frase)
        self.assertNotIn("Unknown", frase)

    def test_sem_nada_legivel_ainda_devolve_frase(self):
        self.assertTrue(_publish_error_detail({}, "o story").strip())


if __name__ == "__main__":
    unittest.main()
