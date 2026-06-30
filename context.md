# 4Core Plataforma - Contexto Atual

Atualizado em 2026-06-30.

## Visao geral
A 4Core e uma plataforma interna de gestao para financeiro, comercial/CRM, marketing, contratos, conhecimento, relatorios e apoio por IA. O backend e uma API Python/FastAPI e o frontend e um app React/TypeScript com Vite e Tailwind.

## Stack principal
- Backend: Python, FastAPI, SQLAlchemy, Pydantic, Alembic, SQLite local e preparo para PostgreSQL/Supabase em producao.
- Frontend: React 18, TypeScript, Vite, TailwindCSS, React Router, Axios, Recharts, Zustand, Framer Motion, Lucide e TanStack Table.
- Integracoes previstas ou parciais: ASAAS, Supabase para metricas/leads do site e storage de contratos, Meta/Instagram, Groq e Resend.
- Configuracao: `.env` na raiz, `.env.example`, `backend/.env.example`.

## Como rodar localmente
- Backend: a aplicacao FastAPI esta em `backend/app/server.py`.
- Comando recomendado: em `backend/`, rodar `python run.py` ou `python -m uvicorn app.server:app --host 127.0.0.1 --port 8001 --reload`.
- Healthcheck: `GET http://127.0.0.1:8001/health`.
- Frontend: em `frontend/`, rodar `npm run dev -- --host 127.0.0.1 --port 5174`.
- URL local do frontend: `http://127.0.0.1:5174`.
- O frontend usa `VITE_API_BASE_URL`; o `.env` local e o fallback do codigo apontam para `http://127.0.0.1:8001`.
- O CORS local esperado no backend inclui `http://127.0.0.1:5174` e `http://localhost:5174`.

## Estrutura do repositorio
- `backend/`: API, modelos, rotas, servicos, database/session, migrations Alembic, seeds e scripts de execucao.
- `frontend/`: app React, rotas, layouts, paginas, componentes compartilhados, stores e servico Axios.
- `docs/`: arquitetura, rotas, modelo de dados, telas planejadas, configuracao de dados reais e integracao com metricas do site.

## Backend
### Organizacao
- `backend/app/server.py`: instancia FastAPI, CORS, middleware JWT global, startup e inclusao de routers.
- `backend/app/core`: configuracao e seguranca.
- `backend/app/database`: sessao SQLAlchemy e ajustes de schema em runtime.
- `backend/app/models`: modelos persistidos, incluindo usuarios e contratos/pedidos.
- `backend/app/routes`: endpoints por dominio.
- `backend/app/services`: integracoes e servicos de apoio, incluindo ASAAS, Instagram, IA, Supabase/site analytics, armazenamento de contratos, financeiro manual e bootstrap de admin.
- `backend/alembic`: migrations.

### Rotas principais
- Publicas: `GET /health`, `POST /auth/login`, `POST /auth/register`.
- Autenticacao e usuarios: `/auth/me`, `/auth/logout`, `/auth/users`.
- Dashboard: `/dashboard/summary`.
- Financeiro: `/financial/overview`, `/financial/transactions`, `/financial/categories`, `/financial/manual`, `/financial/expenses`, `/financial/direct-sales`.
- Comercial/CRM: `/leads`, `/clients`, `/proposals`, `/contracts`, `/orders`.
- Marketing: `/marketing/posts`.
- Conhecimento: `/knowledge`.
- IA: `/ai/analyze`, `/ai/capabilities`.
- Site analytics: `/site/dashboard`.
- Integracoes: `/integrations/status`.

### Autenticacao e bootstrap
- Todas as rotas, exceto health/login/register e OPTIONS, exigem JWT Bearer.
- No startup, o backend cria as tabelas via SQLAlchemy, aplica ajustes pontuais de schema e cria um admin inicial se `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` estiverem configurados e o banco estiver vazio.

## Frontend
### Organizacao
- `frontend/src/App.tsx`: roteamento principal com layouts aninhados.
- `frontend/src/components`: layout principal e menu.
- `frontend/src/shared/components`: UI reutilizavel, layouts e componentes de IA.
- `frontend/src/core/store`: stores de autenticacao e UI.
- `frontend/src/services/api.ts`: Axios, base URL e interceptors de token/sessao.
- `frontend/src/pages`: paginas e submodulos por dominio.

### Rotas e areas atuais
- Login: `/login`.
- Visao geral: `/dashboard`, `/site-metrics`.
- Comercial: `/comercial/leads`, `/comercial/clientes`, `/comercial/pipeline`, `/comercial/funil`, `/comercial/propostas`, `/comercial/contratos`, `/comercial/agenda`, `/comercial/followup`.
- Financeiro: `/financeiro`, `/financeiro/receita`, `/financeiro/custos-fixos`, `/financeiro/custos-recorrentes`, com redirecionamentos para rotas legadas.
- Marketing: `/marketing/calendario`, `/marketing/posts`, `/marketing/ideias`, `/marketing/metricas`, `/marketing/campanhas`, `/marketing/planejamento`.
- IA: `/ia/chat`, `/ia/sugestoes`, `/ia/analises`, `/ia/resumos`.
- Relatorios: `/relatorios`, `/relatorios/financeiros`, `/relatorios/comerciais`.
- Sistema: `/settings`, `/knowledge`.
- Rotas legadas como `/financial`, `/clients`, `/leads`, `/proposals`, `/contracts`, `/ai` e `/reports` redirecionam para as novas areas.

## Dados reais e seguranca
- Chaves secretas devem ficar somente no backend ou na raiz `.env`; nao usar prefixo `VITE_` para segredos.
- Supabase: `SITE_SUPABASE_URL` e `SITE_SUPABASE_SERVICE_ROLE_KEY` sao usados pelo backend para metricas/leads do site; a `service_role` nunca deve ir para o frontend.
- ASAAS, Meta/Instagram, Groq e Resend sao configurados por variaveis de ambiente e podem aparecer como indisponiveis em `/integrations/status` se nao estiverem preenchidos.
- Em producao, usar `SECRET_KEY` forte, `DATABASE_URL` de producao e `CORS_ORIGINS` restrito ao dominio publico do ERP.

## Documentacao existente
- `docs/technical-architecture.md`: arquitetura tecnica, stack e estrategia.
- `docs/api-routes.md`: rotas principais planejadas da API.
- `docs/data-model.md`: modelo de dados inicial e entidades.
- `docs/frontend-screens.md`: telas planejadas e navegacao.
- `docs/real-data-configuration.md`: variaveis e cuidados para dados reais.
- `docs/site-analytics-integration.md`: integracao com Supabase do site.

## Estado atual
- Projeto possui frontend modular por areas, com rotas aninhadas e redirecionamentos de compatibilidade.
- Backend possui middleware global de autenticacao JWT e rotas para os principais modulos.
- A documentacao inicial existe, mas parte dela ainda parece mais planejada do que refletida em implementacao completa.
- O `context.md` anterior estava desatualizado e com problemas de encoding; este arquivo foi reescrito em ASCII para evitar nova corrupcao de acentos.

## Proximos passos sugeridos
1. Validar ponta a ponta login, bootstrap admin e chamadas autenticadas do frontend.
2. Atualizar READMEs que ainda apontam para `app.main:app`; o entrypoint atual e `app.server:app`.
3. Revisar quais paginas ainda usam dados mockados e conectar aos endpoints reais existentes.
4. Completar CRUDs e persistencia dos modulos comercial, marketing, conhecimento e propostas.
5. Consolidar migracoes Alembic para refletir todos os modelos atuais antes de migrar para PostgreSQL/Supabase.

## Nota operacional local
- Em 2026-06-30, a instalacao completa de `backend/requirements.txt` no Python 3.13 falhou em `psycopg2-binary==2.9.9` por falta de `pg_config`; para SQLite local, as demais dependencias foram instaladas no `.venv` e o backend pode rodar normalmente.




