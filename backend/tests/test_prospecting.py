import asyncio
import unittest
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.session import Base
from app.models.commercial import Lead
from app.models.prospecting import Prospect, ProspectingCampaign
from app.models.user import User
from app.services.prospecting_service import (
    add_business_days,
    build_prospect_email_html,
    default_draft,
    distribute_daily_queue,
    normalize_casa_company,
    score_company,
    send_prospect_email,
)


class ProspectingRulesTests(unittest.TestCase):
    def test_score_prioritizes_recent_non_mei_target_company(self):
        result = score_company({
            "opened_at": "2025-11-10",
            "cnae_code": "4930202",
            "company_size": "Empresa de Pequeno Porte",
            "capital_social": 120000,
            "email": "contato@transportadora.test",
            "phone": "41999999999",
            "is_mei": False,
        }, today=date(2026, 9, 14))

        self.assertGreaterEqual(result["score"], 90)
        self.assertEqual(result["employee_confidence"], "high")
        self.assertTrue(any("6 e 18" in reason for reason in result["score_reasons"]))

    def test_mei_is_not_presented_as_likely_six_employee_company(self):
        result = score_company({
            "opened_at": "2026-01-10",
            "cnae_code": "8121400",
            "company_size": "Micro Empresa",
            "capital_social": 5000,
            "phone": "41999999999",
            "is_mei": True,
        }, today=date(2026, 9, 14))

        self.assertLess(result["score"], 55)
        self.assertEqual(result["employee_confidence"], "low")

    def test_casa_payload_is_normalized(self):
        item = normalize_casa_company({
            "cnpj": "12.345.678/0001-90",
            "razao_social": "CLINICA EXEMPLO LTDA",
            "nome_fantasia": "Clínica Exemplo",
            "codigo_atividade_principal": "8630503",
            "data_abertura": "2025-12-10",
            "porte_empresa": {"codigo": "03", "descricao": "EMPRESA DE PEQUENO PORTE"},
            "capital_social": 100000,
            "telefone": "999999999",
            "ddd": "41",
            "email": "CONTATO@EXEMPLO.COM.BR",
            "endereco": {"municipio": "Curitiba", "uf": "PR"},
        })

        self.assertEqual(item["cnpj"], "12345678000190")
        self.assertEqual(item["segment"], "Saúde")
        self.assertEqual(item["phone"], "41999999999")
        self.assertEqual(item["email"], "contato@exemplo.com.br")

    def test_followup_skips_weekend(self):
        friday = datetime(2026, 9, 18, 12, tzinfo=timezone.utc)
        self.assertEqual(add_business_days(friday, 1).date(), date(2026, 9, 21))

    def test_email_requires_approved_approach(self):
        prospect = Prospect(cnpj="12345678000190", company_name="Empresa", email="contato@empresa.test", status="new")
        with self.assertRaises(HTTPException) as context:
            asyncio.run(send_prospect_email(None, prospect, "Assunto", "Mensagem"))
        self.assertEqual(context.exception.status_code, 409)

    def test_default_draft_opens_conversation_without_asking_for_a_meeting(self):
        prospect = Prospect(cnpj="12345678000190", company_name="Empresa Exemplo")
        draft = default_draft(prospect)

        self.assertIn("4core.site", draft["email"])
        self.assertIn("WhatsApp", draft["email"])
        self.assertNotIn("agendar", draft["email"].lower())
        self.assertNotIn("demonstração", draft["email"].lower())
        self.assertLessEqual(len(draft["email"].split()), 75)

    def test_html_email_has_brand_ctas_and_escapes_dynamic_content(self):
        html = build_prospect_email_html(
            "Olá!\n\nVamos conversar sobre <controle de ponto>?\n\nEquipe Comercial 4Core",
            "Empresa <Exemplo>",
        )

        self.assertIn('lang="pt-BR"', html)
        self.assertIn("Conversar pelo WhatsApp", html)
        self.assertIn("https://4core.site", html)
        self.assertIn("&lt;controle de ponto&gt;", html)
        self.assertIn("Empresa &lt;Exemplo&gt;", html)
        self.assertNotIn("Empresa <Exemplo>", html)


class ProspectingDistributionTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.users = [
            User(full_name=f"Comercial {index}", email=f"comercial{index}@4core.site", hashed_password="x")
            for index in range(1, 4)
        ]
        self.db.add_all(self.users)
        self.db.flush()
        self.db.add(ProspectingCampaign(seller_ids=f"[{','.join(str(user.id) for user in self.users)}]", daily_per_seller=5))
        self.db.add_all([
            Prospect(cnpj=f"12345678000{index:03d}"[-14:], company_name=f"Empresa {index}", score=100 - index)
            for index in range(15)
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_distributes_five_prospects_to_each_commercial(self):
        result = distribute_daily_queue(self.db)
        self.assertEqual(result["assigned"], 15)
        self.assertEqual(sorted(result["counts"].values()), [5, 5, 5])


if __name__ == "__main__":
    unittest.main()
