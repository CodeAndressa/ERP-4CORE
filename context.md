# 4Core Plataforma - Contexto Atual

## Visão geral
A plataforma 4Core é uma aplicação interna com foco em gestão financeira, CRM, marketing, conhecimento e recomendações com IA. O MVP utiliza backend em Python/FastAPI e frontend em React/TypeScript com Tailwind.

## Tecnologias
- Backend: Python, FastAPI, SQLAlchemy, Pydantic, Alembic, SQLite (MVP), JWT
- Frontend: React 18, TypeScript, Vite, TailwindCSS, React Router, Axios, Recharts
- Documentação: `docs/`
- Configuração: `.env`, `.env.example`

## Estrutura do repositório
- `backend/`: API, modelos, rotas, serviços, migrations e seeds
- `frontend/`: app React, páginas, componentes e estilos
- `docs/`: arquitetura técnica, rotas, modelo de dados e telas planejadas

## Backend
### Organização
- `backend/app/core`: configuração, banco, segurança
- `backend/app/models`: entidades de domínio
- `backend/app/schemas`: Pydantic DTOs e validações
- `backend/app/routes`: endpoints por módulo
- `backend/app/services`: integrações mockadas com ASAAS, Instagram, IA
- `backend/app/reports`: geração de PDF
- `backend/alembic`: migrations

### Rotas e módulos definidos
- Autenticação: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- Dashboard: `GET /dashboard/summary`
- Financeiro: transações, categorias, contas, custos fixos, previsões, receita recorrente
- CRM: leads CRUD e conversão de leads
- Clientes: CRUD de clientes
- Propostas: CRUD e ações de aprovação/reprovação
- Marketing: posts e calendário editorial
- Conhecimento: base de conhecimento CRUD
- IA: recomendações

### Observações atuais
- MVP preparado para migração futura a PostgreSQL
- Autenticação simples via JWT
- SQLite local como banco de prova

## Frontend
### Organização
- `frontend/src/App.tsx`: roteamento principal
- `frontend/src/components/`: layout e menu
- `frontend/src/pages/`: telas de app
- `frontend/src/services/api.ts`: configuração de chamada ao backend
- `frontend/src/styles.css`: tema e tokens visuais

### Páginas implementadas
- `/login`: tela de login
- `/dashboard`: dashboard executivo
- `/marketing`: página de marketing com métricas mockadas
- `/financial`: área financeira básica
- `/clients`: gerenciamento básico de clientes
- `/leads`: visão de leads

### Layout e navegação
- Sidebar lateral criada em `frontend/src/components/MainMenu.tsx`
- `AppLayout.tsx` centraliza o layout com sidebar e área de conteúdo
- Rotas configuradas em `App.tsx` com layout aninhado

### Marketing atual
A área de marketing inclui:
- métricas de alcance, impressões, engajamento, leads e cliques
- calendário editorial com status de posts
- lista de indicadores recomendados para acompanhar
- ativos de marketing e próximos passos

## Documentação existente
- `docs/technical-architecture.md`: arquitetura técnica, stack e estratégia
- `docs/api-routes.md`: rotas principais planejadas da API
- `docs/data-model.md`: modelo de dados inicial e entidades principais
- `docs/frontend-screens.md`: telas planejadas e navegação inicial

## Estado atual
- Frontend build validado com sucesso
- Sidebar de navegação funcional
- Página de marketing com dados mockados implementada
- Backend esboçado com rotas de autenticação e dashboard
- Documentação inicial já em `docs/`

## Próximos passos sugeridos
1. Implementar CRUDs reais para marketing, clientes, leads e propostas
2. Completar integração backend/frontend com endpoints reais
3. Adicionar telas e rotas para `proposals`, `knowledge` e `ai`
4. Evoluir modelo de dados para relacionamentos e migração PostgreSQL
5. Adicionar relatórios PDF e importação/exportação de Excel
