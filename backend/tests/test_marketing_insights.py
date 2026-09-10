import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.services.marketing_insights_service import schedule_coverage
from app.services.marketing_insights_service import safe_schedule_coverage


class BrokenSession:
    def get_bind(self):
        raise RuntimeError("schema temporarily unavailable")

    def rollback(self):
        pass


class MarketingInsightsTests(unittest.TestCase):
    def test_coverage_counts_legacy_tables_without_layout(self):
        engine = create_engine("sqlite://")
        future = (datetime.now(timezone.utc) + timedelta(days=2)).replace(tzinfo=None)
        with engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE marketing_content (
                    id INTEGER PRIMARY KEY, title VARCHAR(180) NOT NULL,
                    status VARCHAR(40) NOT NULL, scheduled_at DATETIME
                )
            """))
            connection.execute(text("""
                CREATE TABLE external_scheduled_posts (
                    id INTEGER PRIMARY KEY, title VARCHAR(180) NOT NULL,
                    scheduled_at DATETIME NOT NULL
                )
            """))
            connection.execute(
                text("INSERT INTO marketing_content (id, title, status, scheduled_at) VALUES (1, 'ERP', 'scheduled', :future)"),
                {"future": future.isoformat(sep=" ")},
            )
            connection.execute(
                text("INSERT INTO external_scheduled_posts (id, title, scheduled_at) VALUES (1, 'Externo', :future)"),
                {"future": future.isoformat(sep=" ")},
            )

        with Session(engine) as db:
            result = schedule_coverage(db)

        self.assertEqual(result["total_upcoming"], 2)
        self.assertEqual(result["in_next_7_days"], 2)
        self.assertEqual(result["by_source"], {"erp": 1, "externo": 1})
        self.assertFalse(result["partial"])

    def test_schedule_failure_does_not_abort_insights(self):
        errors: dict[str, str] = {}

        result = safe_schedule_coverage(BrokenSession(), errors)

        self.assertTrue(result["partial"])
        self.assertEqual(result["total_upcoming"], 0)
        self.assertEqual(errors["agendamento_erp"], "RuntimeError")
        self.assertEqual(errors["agendamento_externo"], "RuntimeError")


if __name__ == "__main__":
    unittest.main()
