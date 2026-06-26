# Modelo de dados inicial

## Entidades principais
- User
- Transaction
- FinancialCategory
- FinancialAccount
- FixedCost
- BudgetForecast
- RecurringRevenue
- OneOffRevenue
- Lead
- Client
- Proposal
- MarketingPost
- KnowledgeEntry
- Recommendation

## Relacionamentos principais
- Transaction -> FinancialCategory
- Transaction -> FinancialAccount
- Transaction -> Client
- Lead -> Client (conversão)
- Proposal -> Client ou Lead
- Client -> Proposal
- Post -> User (responsável)
- KnowledgeEntry -> User (criador)

## Observações
O modelo foi pensado para ser simples no MVP, mas com estrutura suficiente para evoluir para PostgreSQL sem reescrever o domínio.
