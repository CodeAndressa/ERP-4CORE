# Configuração para dados reais

Copie `.env.example` para `.env` e preencha somente as integrações que serão usadas. Nenhuma variável com chave secreta deve receber o prefixo `VITE_`, pois esse prefixo envia a variável ao navegador.

| Módulo no ERP | Dados necessários | Onde obter |
| --- | --- | --- |
| Métricas do site e leads | `SITE_SUPABASE_URL`, `SITE_SUPABASE_SERVICE_ROLE_KEY` | Supabase do 4core.site: Settings > API |
| Financeiro | `ASAAS_API_KEY` | Asaas: Integrações > Chaves de API |
| Marketing | `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Meta for Developers e Meta Business Suite |
| Assistente IA | `GROQ_API_KEY`, `GROQ_MODEL` | Groq Console: API Keys |
| E-mails | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` | Resend: API Keys e Domains |

## Regras de segurança

- Use a chave `service_role` do Supabase apenas no backend. Ela nunca deve ser enviada ao frontend ou versionada.
- Gere `SECRET_KEY` com um gerenciador de senhas, com ao menos 32 caracteres aleatórios.
- Em produção, altere `DATABASE_URL` para PostgreSQL e restrinja `CORS_ORIGINS` ao domínio do ERP.
- Depois de mudar o `.env`, reinicie o backend.

## Como conferir no ERP

A tela **Configurações** consulta `GET /integrations/status`. Ela só mostra se cada integração está pronta; nenhum segredo é retornado.