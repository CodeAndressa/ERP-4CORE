from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    return {
        "saldo_previsto_mes": 42000,
        "entradas_realizadas": 36000,
        "saidas_realizadas": 18500,
        "contas_a_receber": 8750,
        "contas_a_pagar": 6200,
        "custos_fixos_mes": 12400,
        "receita_recorrente_mensal": 24000,
        "receita_avulsa_mes": 5200,
        "leads_novos": 8,
        "oportunidades_abertas": 5,
        "propostas_enviadas": 10,
        "propostas_ganhas": 3,
        "propostas_perdidas": 2,
        "clientes_ativos": 14,
        "posts_planejados": 4,
        "metricas_marketing": {
            "alcance": 18200,
            "engajamento": 5.4,
            "leads": 3,
        },
        "alertas_financeiros": ["Cobrança em atraso", "Conta de energia vence hoje"],
        "alertas_comerciais": ["Follow-up de 2 leads pendente"],
    }
