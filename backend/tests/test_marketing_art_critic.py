"""As travas do crítico de arte e do laço de refação.

Cada teste aqui corresponde a um jeito conhecido de o padrão evaluator-optimizer
degradar em vez de melhorar. Não são hipóteses: são modos de falha medidos na
literatura, e aqui cada volta do laço custa uma imagem inteira (US$ 0,04), que é
94% do custo da peça.

- Reprovar sem dizer o que está errado faz a refação virar tentativa aleatória.
- Nota média esconde a dimensão grave: marca 9 e produto errado 3 dá média 6.
- Sem teto, o laço roda para sempre.
- Sem parada por não-melhora, o laço oscila entre duas versões ruins.
- Se a falha do próprio crítico derrubar a peça, trocamos um problema caro por
  um pior: deixar de produzir por causa do revisor.
"""

import unittest

from app.services.marketing_art_critic import (
    APPROVAL_FLOOR,
    MAX_REDOS,
    avaliar_resultado,
    instrucao_de_correcao,
)

BOA = {"produto": 9, "camadas": 8, "legibilidade": 9, "marca": 9, "resumo": "Peça coerente."}


class VereditoTests(unittest.TestCase):
    def test_tudo_acima_do_corte_aprova(self):
        v = avaliar_resultado(BOA)
        self.assertTrue(v["aprovado"])
        self.assertEqual(v["reprovadas"], [])
        self.assertEqual(v["nota_minima"], 8)

    def test_uma_dimensao_grave_reprova_mesmo_com_media_alta(self):
        """Marca 10, legibilidade 10, camadas 10 e produto 3 dá média 8,25.

        Média aprovaria uma peça que mostra o produto errado, que é o defeito
        mais caro que existe aqui: vender uma coisa mostrando outra."""
        v = avaliar_resultado({
            **BOA, "produto": 3,
            "problemas": {"produto": "O terminal tem tela alongada e não tem a barra branca no topo"},
        })
        self.assertFalse(v["aprovado"])
        self.assertEqual([p["dimensao"] for p in v["reprovadas"]], ["produto"])

    def test_reprovada_sem_o_problema_citado_passa(self):
        """Crítica vaga é pior que nenhuma: custa uma imagem e não diz o que mudar.

        A literatura condiciona o padrão a o crítico conseguir articular a
        correção; sem o ponto específico o gerador produz outra coisa aleatória,
        não uma correção."""
        v = avaliar_resultado({**BOA, "camadas": 2, "problemas": {}})
        self.assertTrue(v["aprovado"])

    def test_problema_so_de_espaco_tambem_nao_conta(self):
        v = avaliar_resultado({**BOA, "camadas": 2, "problemas": {"camadas": "   "}})
        self.assertTrue(v["aprovado"])

    def test_nota_fora_da_escala_e_contida(self):
        v = avaliar_resultado({"produto": 99, "camadas": -5, "legibilidade": 8, "marca": 8})
        self.assertEqual(v["notas"]["produto"], 10.0)
        self.assertEqual(v["notas"]["camadas"], 0.0)

    def test_nota_que_nao_e_numero_vira_zero(self):
        """Modelo devolvendo "alta" em vez de 8 não pode virar aprovação."""
        v = avaliar_resultado({**BOA, "produto": "ótimo", "problemas": {"produto": "não é o aparelho da 4Core"}})
        self.assertEqual(v["notas"]["produto"], 0.0)
        self.assertFalse(v["aprovado"])

    def test_resposta_vazia_reprova_sem_estourar(self):
        v = avaliar_resultado({})
        self.assertEqual(v["nota_minima"], 0.0)
        self.assertTrue(v["aprovado"])  # sem problema citado, segue para a pessoa

    def test_o_corte_e_o_sete_pedido(self):
        self.assertEqual(APPROVAL_FLOOR, 7.0)
        no_corte = avaliar_resultado({**BOA, "marca": 7, "problemas": {"marca": "x"}})
        self.assertTrue(no_corte["aprovado"], "7 é o piso de aprovação, não de reprovação")
        abaixo = avaliar_resultado({**BOA, "marca": 6.9, "problemas": {"marca": "paleta azul"}})
        self.assertFalse(abaixo["aprovado"])


class CorrecaoTests(unittest.TestCase):
    def test_correcao_leva_so_o_que_foi_apontado(self):
        v = avaliar_resultado({
            **BOA, "produto": 4, "legibilidade": 5,
            "problemas": {
                "produto": "aparelho diferente do REP-P",
                "legibilidade": "a terceira linha sai da caixa",
                "marca": "isto nao deveria entrar, a marca passou",
            },
        })
        texto = instrucao_de_correcao(v)
        self.assertIn("aparelho diferente do REP-P", texto)
        self.assertIn("a terceira linha sai da caixa", texto)
        self.assertNotIn("isto nao deveria entrar", texto)

    def test_peca_aprovada_nao_gera_correcao(self):
        self.assertEqual(instrucao_de_correcao(avaliar_resultado(BOA)), "")


class TetoTests(unittest.TestCase):
    def test_o_teto_e_dois(self):
        """Dois, não cinco. O ganho do padrão vem da existência do laço, não da
        profundidade, e cada volta custa uma imagem inteira."""
        self.assertEqual(MAX_REDOS, 2)

    def test_simulacao_do_laco_para_quando_nao_melhora(self):
        """O laço da esteira para se a nota mínima não subiu entre tentativas.

        Sem isso ele oscila entre duas versões ruins até bater o teto, gastando
        US$ 0,04 por volta para terminar no mesmo lugar."""
        sequencia = [
            avaliar_resultado({**BOA, "produto": 4, "problemas": {"produto": "errado"}}),
            avaliar_resultado({**BOA, "produto": 4, "problemas": {"produto": "ainda errado"}}),
        ]
        voltas = 0
        anterior = None
        for veredito in sequencia:
            if anterior and veredito["nota_minima"] <= anterior["nota_minima"]:
                break
            anterior = veredito
            voltas += 1
        self.assertEqual(voltas, 1, "deveria ter parado na segunda, que não melhorou")

    def test_simulacao_do_laco_segue_quando_melhora(self):
        sequencia = [
            avaliar_resultado({**BOA, "produto": 3, "problemas": {"produto": "errado"}}),
            avaliar_resultado({**BOA, "produto": 6, "problemas": {"produto": "quase"}}),
        ]
        voltas = 0
        anterior = None
        for veredito in sequencia:
            if anterior and veredito["nota_minima"] <= anterior["nota_minima"]:
                break
            anterior = veredito
            voltas += 1
        self.assertEqual(voltas, 2)


if __name__ == "__main__":
    unittest.main()
