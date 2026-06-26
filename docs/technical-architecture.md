# Arquitetura técnica da solução

## Backend
- Python 3.11+
- FastAPI para API REST
- SQLAlchemy para ORM
- Pydantic para validação
- SQLite no MVP
- Alembic para migrations
- JWT simples para autenticação
- Pandas/OpenPyXL para importação/exportação
- ReportLab para PDF

## Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- Shadcn UI
- Axios
- React Router
- Recharts
- FullCalendar-like calendar placeholder

## Arquitetura de pastas
- backend/app/core: configuração, banco, segurança
- backend/app/models: entidades do domínio
- backend/app/schemas: DTOs e validações
- backend/app/routes: endpoints por módulo
- backend/app/services: integrações externas e regras de negócio
- backend/app/reports: geração de PDF
- backend/app/seeds: seed inicial
- backend/alembic: migrations
- frontend/src: páginas, componentes, serviços e tipos

## Estratégia de evolução
1. MVP local com SQLite
2. CRUDs essenciais e dashboard
3. Relatórios PDF e importação/exportação Excel
4. Integrações ASAAS e Instagram
5. IA com base de conhecimento
6. Migração para PostgreSQL
