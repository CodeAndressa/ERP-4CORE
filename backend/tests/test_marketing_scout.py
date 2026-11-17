"""O batedor: o que conta como "post que bombou" e o que é só oscilação.

Esta é a parte do sistema onde a superstição entra mais fácil. A pesquisa que
embasou o plano é explícita: com volume baixo, atribuir significado a diferença
pequena é ruído, e o erro mais comum do mercado é vender oscilação como
tendência.

Então as regras aqui são conservadoras de propósito, e estes testes existem para
que continuem sendo quando alguém quiser "achar mais coisa".
"""

import unittest
from datetime import datetime, timedelta, timezone

from app.services.marketing_scout import (
    DESTAQUE_MINIMO,
    JANELA_DIAS,
    MINIMO_DE_POSTS,
    destaques_do_perfil,
)


def _post(likes: int, dias_atras: int = 5, comentarios: int = 0, legenda: str = "x"):
    quando = datetime.now(timezone.utc) - timedelta(days=dias_atras)
    return {
        "like_count": likes,
        "comments_count": comentarios,
        "timestamp": quando.isoformat().replace("+00:00", "Z"),
        "caption": legenda,
        "media_type": "IMAGE",
        "permalink": "https://instagram.com/p/x",
    }


class DestaqueTests(unittest.TestCase):
    def test_post_muito_acima_da_mediana_e_destaque(self):
        posts = [_post(100), _post(110), _post(90), _post(105), _post(400)]
        achados = destaques_do_perfil("perfil", posts)
        self.assertEqual(len(achados), 1)
        self.assertEqual(achados[0]["engajamento"], 400)
        self.assertGreaterEqual(achados[0]["razao"], DESTAQUE_MINIMO)

    def test_oscilacao_normal_nao_e_destaque(self):
        """Um post 30% acima da mediana é um dia bom, não é assunto que pegou.

        É exatamente aqui que o mercado inteiro erra: tratar diferença pequena
        como sinal produz pauta baseada em nada."""
        posts = [_post(100), _post(110), _post(90), _post(105), _post(130)]
        self.assertEqual(destaques_do_perfil("perfil", posts), [])

    def test_conta_com_poucos_posts_nao_rende_conclusao(self):
        """Com menos de alguns posts não há mediana que signifique coisa alguma."""
        posts = [_post(100), _post(900)]
        self.assertLess(len(posts), MINIMO_DE_POSTS)
        self.assertEqual(destaques_do_perfil("perfil", posts), [])

    def test_usa_mediana_e_nao_media(self):
        """Um viral isolado puxaria a média e esconderia os outros destaques.

        Com média, a base aqui seria ~1.800 e nada mais apareceria. Com mediana
        ela fica em 100, e o viral aparece como o que é."""
        posts = [_post(100), _post(100), _post(100), _post(100), _post(10000)]
        achados = destaques_do_perfil("perfil", posts)
        self.assertEqual(len(achados), 1)
        self.assertEqual(achados[0]["mediana_da_conta"], 100)

    def test_post_antigo_fica_de_fora(self):
        """Assunto que pegou há três meses é histórico, não pauta."""
        posts = [_post(100), _post(100), _post(100), _post(100), _post(500, dias_atras=JANELA_DIAS + 10)]
        self.assertEqual(destaques_do_perfil("perfil", posts), [])

    def test_comentario_conta_junto_com_curtida(self):
        posts = [_post(100), _post(100), _post(100), _post(100), _post(120, comentarios=200)]
        achados = destaques_do_perfil("perfil", posts)
        self.assertEqual(len(achados), 1)
        self.assertEqual(achados[0]["engajamento"], 320)

    def test_conta_sem_engajamento_nenhum_nao_divide_por_zero(self):
        posts = [_post(0), _post(0), _post(0), _post(0), _post(0)]
        self.assertEqual(destaques_do_perfil("perfil", posts), [])

    def test_post_sem_data_e_ignorado_sem_estourar(self):
        posts = [_post(100), _post(100), _post(100), _post(100), {"like_count": 900}]
        achados = destaques_do_perfil("perfil", posts)
        self.assertEqual(achados, [])

    def test_data_invalida_e_ignorada_sem_estourar(self):
        posts = [_post(100), _post(100), _post(100), _post(100), {"like_count": 900, "timestamp": "ontem"}]
        self.assertEqual(destaques_do_perfil("perfil", posts), [])

    def test_achados_vem_do_mais_forte_para_o_mais_fraco(self):
        posts = [_post(100), _post(100), _post(100), _post(100), _post(300), _post(900)]
        achados = destaques_do_perfil("perfil", posts)
        self.assertEqual([a["engajamento"] for a in achados], [900, 300])

    def test_a_fonte_vem_identificada(self):
        posts = [_post(100), _post(100), _post(100), _post(100), _post(500)]
        self.assertEqual(destaques_do_perfil("topdatasistemas", posts)[0]["fonte"], "@topdatasistemas")


if __name__ == "__main__":
    unittest.main()
