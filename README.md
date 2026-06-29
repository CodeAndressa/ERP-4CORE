# ERP 4Core

Plataforma interna para gest?o financeira, comercial, clientes, marketing, conhecimento institucional e recomenda??es com IA.

## Stack

- Backend: Python, FastAPI, SQLAlchemy e SQLite
- Frontend: React, TypeScript, Vite e Tailwind CSS
- Integra??es: ASAAS, Supabase, IA e futura Meta/Instagram

## Deploy

Frontend na Vercel:

- `VITE_API_BASE_URL`: URL p?blica do backend, sem barra final
- `VITE_PUBLIC_URL`: URL p?blica do frontend

Backend:

- `APP_ENV=production`
- `SECRET_KEY`: chave longa e aleat?ria, diferente de `change-me`
- `CORS_ORIGINS`: URL p?blica do frontend, por exemplo `https://app.4core.site`
- `DATABASE_URL`: banco de produ??o
- `ASAAS_API_KEY`: chave do ASAAS, somente no backend
- `SITE_SUPABASE_URL` e `SITE_SUPABASE_SERVICE_ROLE_KEY`: somente no backend
- `CONTRACT_STORAGE_BUCKET`: bucket do Supabase Storage para PDFs de contratos, padr?o `contracts`
- `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`: criam o primeiro usu?rio quando o banco ainda est? vazio
- `GROQ_API_KEY`: somente no backend, se a IA estiver ativa

## Seguran?a

As rotas internas do frontend exigem token de acesso e as APIs do backend, exceto `/health`, `/auth/login` e `/auth/register`, exigem JWT válido. Sessões expiradas são limpas automaticamente no frontend.

## M?dulos

- Dashboard executivo com financeiro, comercial, site e marketing
- Financeiro com Receita, Custos Fixos e Custos Recorrentes
- Comercial com leads, clientes, pipeline, propostas, contratos, agenda e follow-up
- Marketing com calend?rio, posts, ideias, m?tricas e campanhas
- IA, relat?rios, configura??es e base de conhecimento
