from __future__ import annotations

"""Inventário das variáveis de ambiente: o que está configurado e o que quebra sem.

Existe porque descobrir que falta uma chave no meio de uma operação é caro. A tela
de Ambiente mostra tudo de uma vez, com o que cada variável desbloqueia e onde ela
é obtida.

**Nenhum valor sai daqui.** O retorno diz apenas se a variável tem conteúdo. Expor
o valor transformaria uma tela de diagnóstico em um vazamento de credencial para
qualquer pessoa com login no ERP.
"""

from typing import Any

from app.core.config import settings

# Cada grupo é uma capacidade do ERP. `required` são as variáveis sem as quais a
# capacidade não funciona; `optional` melhoram ou substituem algo.
GROUPS: list[dict[str, Any]] = [
    {
        "key": "app",
        "name": "Aplicação",
        "unlocks": "Login, sessão e o banco que o backend usa",
        "where": "Definidas por você. Em desenvolvimento, qualquer valor serve no SECRET_KEY.",
        "required": ["SECRET_KEY", "DATABASE_URL"],
        "optional": ["APP_ENV", "CORS_ORIGINS", "ACCESS_TOKEN_EXPIRE_MINUTES"],
    },
    {
        "key": "meta_read",
        "name": "Instagram: leitura",
        "unlocks": "Perfil, posts, métricas e a leitura dos concorrentes na esteira",
        "where": "developers.facebook.com/tools/explorer, escolhendo o app e a página da 4Core",
        "required": ["META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"],
        "optional": ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "META_GRAPH_VERSION"],
        "note": (
            "Só isso já faz a esteira ler o Instagram. O botão Conectar via Meta "
            "precisa do app, abaixo, mas a leitura não depende dele."
        ),
    },
    {
        "key": "meta_app",
        "name": "Instagram: conectar pelo botão",
        "unlocks": "O fluxo Conectar via Meta em Conexões, que renova o token sozinho",
        "where": "developers.facebook.com, app da 4Core, Configurações > Básico",
        "required": ["META_APP_ID", "META_APP_SECRET"],
        "optional": ["META_REDIRECT_URI"],
        "note": (
            "Em desenvolvimento o redirect precisa estar liberado no app da Meta. "
            "Para só testar leitura, pule este grupo e preencha o de cima."
        ),
    },
    {
        "key": "ia_texto",
        "name": "IA de texto",
        "unlocks": "Estrategista, redator, revisor e diretor de arte da esteira",
        "where": "console.groq.com/keys, ou openrouter.ai/keys com OPENROUTER_TEXT_MODEL",
        "required": ["GROQ_API_KEY"],
        "optional": ["GROQ_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_TEXT_MODEL"],
        "alternatives": [["GROQ_API_KEY"], ["OPENROUTER_API_KEY", "OPENROUTER_TEXT_MODEL"]],
    },
    {
        "key": "ia_imagem",
        "name": "IA de imagem",
        "unlocks": "O ilustrador, que gera a arte 4:5 do feed",
        "where": "dash.cloudflare.com > AI > Workers AI, ou openrouter.ai/keys",
        "required": ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
        "optional": ["CLOUDFLARE_IMAGE_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_IMAGE_MODEL", "OPENAI_API_KEY"],
        "alternatives": [["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"], ["OPENROUTER_API_KEY"], ["OPENAI_API_KEY"]],
        "note": (
            "A Cloudflare dá 10 mil neurônios por dia de graça, cerca de 57 imagens. "
            "O OpenRouter custa, mas devolve o custo real de cada chamada."
        ),
    },
    {
        "key": "storage",
        "name": "Storage das artes",
        "unlocks": "Guardar a arte gerada e publicar na Meta, que precisa de URL pública",
        "where": "supabase.com > projeto > Settings > API",
        "required": ["SITE_SUPABASE_URL", "SITE_SUPABASE_SERVICE_ROLE_KEY"],
        "optional": ["MARKETING_ASSETS_BUCKET", "CONTRACT_STORAGE_BUCKET"],
        "note": "Sem isso a arte é salva em disco local e não pode ser publicada pela Meta.",
    },
    {
        "key": "financeiro",
        "name": "Financeiro",
        "unlocks": "Cobranças, conciliação e o painel financeiro",
        "where": "Asaas > Integrações > Chaves de API",
        "required": ["ASAAS_API_KEY"],
        "optional": ["ASAAS_BASE_URL"],
    },
    {
        "key": "automacoes",
        "name": "Rotinas automáticas",
        "unlocks": "Esteira semanal, publicação agendada, régua de cobrança e prospecção",
        "where": "Você define o segredo e repete em Settings > Secrets do GitHub",
        "required": ["MARKETING_CRON_SECRET"],
        "optional": ["CRON_SECRET", "COLLECTIONS_CRON_SECRET", "PROSPECTING_CRON_SECRET"],
    },
]

# Nome da variável no .env mapeado para o atributo em Settings. O pydantic-settings
# já faz minúsculas, então a regra é direta, mas deixar explícito evita que renomear
# um campo quebre a tela em silêncio.
def _value(name: str) -> str:
    return str(getattr(settings, name.lower(), "") or "")


def _filled(name: str) -> bool:
    value = _value(name).strip()
    if not value:
        return False
    # Valores que existem mas não valem nada: o placeholder do pull da Vercel e o
    # default de desenvolvimento que ninguém deveria levar para produção.
    return value not in {"[SENSITIVE]", "change-me"}


def _group_status(group: dict[str, Any]) -> dict[str, Any]:
    alternatives = group.get("alternatives") or [group["required"]]
    satisfied = any(all(_filled(name) for name in option) for option in alternatives)
    missing = [name for name in group["required"] if not _filled(name)]

    return {
        "key": group["key"],
        "name": group["name"],
        "unlocks": group["unlocks"],
        "where": group["where"],
        "note": group.get("note", ""),
        "ready": satisfied,
        "missing": [] if satisfied else missing,
        "variables": [
            {"name": name, "filled": _filled(name), "required": True}
            for name in group["required"]
        ] + [
            {"name": name, "filled": _filled(name), "required": False}
            for name in group.get("optional", [])
        ],
    }


def env_status() -> dict[str, Any]:
    groups = [_group_status(group) for group in GROUPS]
    ready = [group for group in groups if group["ready"]]
    return {
        # Serve para a tela falar a língua certa: em desenvolvimento o lugar de
        # corrigir é o .env da máquina, em produção é o painel da Vercel.
        "environment": settings.app_env,
        "is_production": settings.app_env.lower() in {"production", "prod"},
        "groups": groups,
        "ready_count": len(ready),
        "total_count": len(groups),
        "all_ready": len(ready) == len(groups),
    }
