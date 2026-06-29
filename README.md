# ERP 4Core

Plataforma interna para gestão financeira, comercial, clientes, marketing, conhecimento institucional e recomendações com IA.

## Stack

- Backend: Python, FastAPI, SQLAlchemy e SQLite
- Frontend: React, TypeScript, Vite e Tailwind CSS
- Integrações: ASAAS, Supabase, IA e futura Meta/Instagram

## Deploy

Frontend na Vercel:

- `VITE_API_BASE_URL`: URL pública do backend, sem barra final
- `VITE_PUBLIC_URL`: URL pública do frontend

Backend:

- `APP_ENV=production`
- `SECRET_KEY`: chave longa e aleatória, diferente de `change-me`
- `CORS_ORIGINS`: URL pública do frontend, por exemplo `https://app.4core.site`
- `DATABASE_URL`: banco de produção
- `ASAAS_API_KEY`: chave do ASAAS, somente no backend
- `SITE_SUPABASE_URL` e `SITE_SUPABASE_SERVICE_ROLE_KEY`: mesmo Supabase usado para métricas/leads do site, somente no backend
- `CONTRACT_STORAGE_BUCKET`: opcional; bucket do Supabase Storage para PDFs de contratos, padrão `contracts`
- `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`: criam o primeiro usuário quando o banco ainda está vazio
- `GROQ_API_KEY`: somente no backend, se a IA estiver ativa

## Segurança

As rotas internas do frontend exigem token de acesso e as APIs do backend, exceto `/health`, `/auth/login` e `/auth/register`, exigem JWT válido. Sessões expiradas são limpas automaticamente no frontend.

## Módulos

- Dashboard executivo com financeiro, comercial, site e marketing
- Financeiro com Receita, Custos Fixos e Custos Recorrentes
- Comercial com leads, clientes, pipeline, propostas, contratos, agenda e follow-up
- Marketing com calendário, posts, ideias, métricas e campanhas
- IA, relatórios, configurações e base de conhecimento
