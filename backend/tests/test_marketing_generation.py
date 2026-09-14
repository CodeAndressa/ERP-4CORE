from __future__ import annotations

import unittest

from PIL import Image, ImageStat

from app.core.config import settings
from app.services.groq_service import DEFAULT_GROQ_MODEL, groq_model_id
from app.services.marketing_brand_system import (
    build_image_prompt,
    normalize_pt_br_text,
    sentence_case,
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


if __name__ == "__main__":
    unittest.main()
