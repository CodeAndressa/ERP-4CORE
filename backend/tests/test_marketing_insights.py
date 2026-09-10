import unittest

from app.services.marketing_insights_service import safe_schedule_coverage


class BrokenSession:
    def query(self, *_args, **_kwargs):
        raise RuntimeError("schema temporarily unavailable")


class MarketingInsightsTests(unittest.TestCase):
    def test_schedule_failure_does_not_abort_insights(self):
        errors: dict[str, str] = {}

        result = safe_schedule_coverage(BrokenSession(), errors)

        self.assertEqual(result, {"erro": "Cobertura de agendamento não respondeu"})
        self.assertEqual(errors["cobertura_agendamento"], "RuntimeError")


if __name__ == "__main__":
    unittest.main()
