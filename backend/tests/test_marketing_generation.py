from __future__ import annotations

import io

import unittest

from PIL import Image, ImageStat

from app.core.config import settings
from app.services.groq_service import DEFAULT_GROQ_MODEL, groq_model_id
from app.services.marketing_brand_system import (
    build_image_prompt,
    normalize_pt_br_text,
    sentence_case,
)
from PIL import Image, ImageDraw

from app.services.marketing_brand_system import PRODUCT_CATALOG, match_product
from app.services.marketing_content_service import (
    _compose_product_art,
    _echoes,
    _scene_consistency,
    _fit_product,
)
from app.services.marketing_content_service import (
    CLOUDFLARE_KLEIN_MODEL,
    CLOUDFLARE_SCHNELL_MODEL,
    _cloudflare_request_kwargs,
    _sanitize_generated_layout,
    cloudflare_image_models,
)


class MarketingGenerationTests(unittest.TestCase):
    def test_deprecated_groq_model_uses_supported_replacement(self) -> None:
        previous = settings.groq_model
        try:
            settings.groq_model = "llama-3.3-70b-versatile"
            self.assertEqual(groq_model_id(), DEFAULT_GROQ_MODEL)
        finally:
            settings.groq_model = previous

    def test_image_prompt_never_receives_brand_or_headline(self) -> None:
        prompt = build_image_prompt(
            "Gestão de risco trabalhista",
            "A Brazilian HR manager reviewing time records beside the 4Core logo",
            "Never repeat the 4Core.site logo or wordmark",
            "Avoid the 4Core brand mark",
        ).lower()

        self.assertNotIn("gestão de risco trabalhista", prompt)
        self.assertNotIn("4core", prompt)
        self.assertNotIn("4core.site", prompt)
        self.assertNotIn("logo", prompt)
        self.assertNotIn("wordmark", prompt)
        self.assertNotIn("brand mark", prompt)

    def test_common_portuguese_accents_are_restored(self) -> None:
        value = normalize_pt_br_text("Gestao e seguranca: voce nao esta sozinho na operacao")
        self.assertEqual(value, "Gestão e segurança: você não esta sozinho na operação")
        self.assertEqual(sentence_case("GESTAO DE RISCO TRABALHISTA"), "Gestão de risco trabalhista")

    def test_generated_template_area_has_no_rectangular_overlay(self) -> None:
        source = Image.new("RGBA", (720, 1280), (255, 255, 255, 255))
        result = _sanitize_generated_layout(source)
        top_left = result.crop((0, 0, 300, 120)).convert("RGB")
        top_right = result.crop((420, 0, 720, 120)).convert("RGB")
        untouched_middle = result.crop((0, 360, 300, 700)).convert("RGB")

        left_mean = sum(ImageStat.Stat(top_left).mean)
        right_mean = sum(ImageStat.Stat(top_right).mean)
        self.assertLess(left_mean, 500)
        self.assertLess(abs(left_mean - right_mean), 2)
        self.assertGreater(sum(ImageStat.Stat(untouched_middle).mean), 750)

    def test_legacy_cloudflare_model_is_migrated_to_free_klein_model(self) -> None:
        previous_model = settings.cloudflare_image_model
        previous_fallback = settings.cloudflare_image_fallback_model
        try:
            settings.cloudflare_image_model = "@cf/leonardo/lucid-origin"
            settings.cloudflare_image_fallback_model = CLOUDFLARE_SCHNELL_MODEL
            self.assertEqual(
                cloudflare_image_models(),
                [CLOUDFLARE_KLEIN_MODEL, CLOUDFLARE_SCHNELL_MODEL],
            )
        finally:
            settings.cloudflare_image_model = previous_model
            settings.cloudflare_image_fallback_model = previous_fallback

    def test_klein_uses_multipart_without_adjustable_steps(self) -> None:
        kwargs = _cloudflare_request_kwargs(CLOUDFLARE_KLEIN_MODEL, "real office photo")
        self.assertIn("files", kwargs)
        self.assertNotIn("json", kwargs)
        self.assertNotIn("Content-Type", kwargs["headers"])
        self.assertNotIn("steps", kwargs["files"])
        self.assertEqual(kwargs["files"]["width"], (None, "720"))
        self.assertEqual(kwargs["files"]["height"], (None, "1280"))

    def test_schnell_fallback_uses_four_steps(self) -> None:
        kwargs = _cloudflare_request_kwargs(CLOUDFLARE_SCHNELL_MODEL, "real office photo")
        self.assertEqual(kwargs["json"]["steps"], 4)
        self.assertNotIn("num_steps", kwargs["json"])



class ArteDeProdutoTests(unittest.TestCase):
    """A peça de produto nasce do catálogo e da foto do site, sem passar por
    modelo de imagem. É o que resolve texto ilegível e marca de concorrente."""

    @staticmethod
    def _foto(width: int, height: int, opaca: bool = False) -> bytes:
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        corpo = Image.new("RGBA", (round(width * 0.8), round(height * 0.8)), (40, 40, 60, 255))
        img.paste(corpo, (round(width * 0.1), round(height * 0.1)))
        if opaca:
            img = Image.new("RGBA", (width, height), (40, 40, 60, 255))
        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()

    def test_pauta_de_produto_encontra_o_produto(self):
        produto = match_product("Vale a pena o reconhecimento facial?", "biometria sem crachá")
        self.assertIsNotNone(produto)
        self.assertEqual(produto["key"], "rep_p_facial")

    def test_pauta_generica_nao_puxa_produto(self):
        self.assertIsNone(match_product("Como dar feedback difícil", "cultura e lideranca"))

    def test_um_termo_solto_nao_basta(self):
        # "acesso" sozinho aparece em pauta que nada tem a ver com catraca.
        self.assertIsNone(match_product("Acesso à informação no RH", ""))

    def test_catalogo_aponta_para_o_site_da_4core(self):
        for produto in PRODUCT_CATALOG:
            self.assertTrue(str(produto["image_url"]).startswith("https://4core.site/"), produto["key"])
            self.assertTrue(produto["name"] and produto["selos"])

    def test_compoe_a_peca_no_tamanho_do_feed(self):
        arte = _compose_product_art(
            self._foto(500, 1000), self._foto(400, 120), "Portaria 671: evite multas agora", PRODUCT_CATALOG[0]
        )
        self.assertEqual(Image.open(io.BytesIO(arte)).size, (1080, 1350))

    def test_gancho_longo_nao_vaza_a_margem(self):
        # O caso que saiu cortado na primeira versão: frase que não cabe em corpo
        # nenhum precisa voltar quebrada, nunca numa linha só.
        longo = "Portaria 671 exige registro eletrônico de ponto em conformidade total agora"
        arte = _compose_product_art(self._foto(500, 1000), self._foto(400, 120), longo, PRODUCT_CATALOG[0])
        imagem = Image.open(io.BytesIO(arte)).convert("RGB")
        largura, altura = imagem.size
        # A coluna de 1px colada na margem direita não pode ter texto branco.
        faixa = imagem.crop((largura - 4, 0, largura, altura)).getcolors(maxcolors=1 << 20) or []
        claros = sum(n for n, cor in faixa if min(cor) > 200)
        self.assertEqual(claros, 0, "o gancho encostou na margem direita")

    def test_a_cena_recebe_o_gancho_para_nao_contradize_lo(self):
        # Peca de 16/11/2026: gancho "sem cracha" e um cracha pendurado na parede.
        instrucao = _scene_consistency("Acesso rapido, sem cracha")
        self.assertIn("Acesso rapido, sem cracha", instrucao)
        self.assertIn("must not contradict", instrucao)
        self.assertIn("badges", instrucao)

    def test_sem_gancho_nao_inventa_restricao(self):
        self.assertEqual(_scene_consistency("   "), "")

    def test_apoio_some_quando_repete_o_gancho(self):
        self.assertTrue(_echoes("Feche a folha sem refazer o mês", "Fecha a folha sem retrabalho"))
        self.assertFalse(_echoes("Portaria 671: evite multas agora", "Registro sem contato, sem fraude"))

    def test_foto_de_cena_ganha_canto_arredondado(self):
        cheia = Image.open(io.BytesIO(self._foto(600, 400, opaca=True))).convert("RGBA")
        ajustada = _fit_product(cheia, 600, 400)
        # Canto superior esquerdo precisa ter virado transparente.
        self.assertLess(ajustada.getchannel("A").getpixel((0, 0)), 40)

    def test_produto_recortado_mantem_a_silhueta(self):
        # Recorte de verdade tem silhueta, então as quinas já nascem vazias e o
        # arredondamento não deve entrar. Um retângulo com moldura transparente não
        # serve de exemplo: o corte pelo alfa o transforma num bloco cheio.
        recortado = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
        ImageDraw.Draw(recortado).ellipse((0, 0, 599, 399), fill=(40, 40, 60, 255))
        antes = recortado.getchannel("A").histogram()[255]
        ajustada = _fit_product(recortado, 600, 400)
        depois = ajustada.getchannel("A").histogram()[255]
        # A área opaca sobrevive: nada foi mascarado por cima da silhueta.
        self.assertAlmostEqual(depois / antes, 1.0, delta=0.02)
        self.assertGreater(ajustada.getchannel("A").getpixel((300, 200)), 200)


if __name__ == "__main__":
    unittest.main()
