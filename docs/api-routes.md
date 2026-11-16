# Rotas principais da API

## Autenticação
- POST /auth/register
- POST /auth/login
- GET /auth/me
- POST /auth/logout

## Dashboard
- GET /dashboard/summary

## Financeiro
- GET /financial/transactions
- POST /financial/transactions
- GET /financial/categories
- GET /financial/accounts
- GET /financial/fixed-costs
- GET /financial/budget-forecast
- GET /financial/recurring-revenue
- GET /financial/one-off-revenue

## CRM
- GET /leads
- POST /leads
- PUT /leads/{id}
- DELETE /leads/{id}
- POST /leads/{id}/convert

## Clientes
- GET /clients
- POST /clients
- PUT /clients/{id}
- DELETE /clients/{id}

## Propostas
- GET /proposals
- POST /proposals
- PUT /proposals/{id}
- POST /proposals/{id}/approve
- POST /proposals/{id}/reject

## Marketing
- GET /marketing/posts
- POST /marketing/posts
- PUT /marketing/posts/{id}

## Agente de conteudo
Detalhe em [agente-conteudo.md](agente-conteudo.md).

- GET /marketing/agent/competitors
- POST /marketing/agent/competitors
- PATCH /marketing/agent/competitors/{id}
- DELETE /marketing/agent/competitors/{id}
- POST /marketing/agent/competitors/sync
- POST /marketing/agent/competitors/{id}/sync
- GET /marketing/agent/competitors/{id}/profile
- GET /marketing/agent/benchmark
- POST /marketing/agent/run
- POST /marketing/agent/run-cron (segredo de cron, sem JWT)
- GET /marketing/agent/runs
- GET /marketing/agent/runs/{id}

## Conhecimento
- GET /knowledge
- POST /knowledge
- PUT /knowledge/{id}

## IA
- GET /ai/recommendations
