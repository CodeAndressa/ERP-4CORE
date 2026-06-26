# Integração do 4core.site

O ERP consulta os dados reais do site pelo backend, sem enviar nenhuma credencial ao navegador.

## Dados trazidos

- visitantes únicos, visualizações e taxa de rejeição;
- conversões de formulário, WhatsApp e captura de lead;
- evolução diária de tráfego e conversões;
- fontes de tráfego, páginas mais vistas e dispositivos;
- leads recentes, com origem, interesse e data de entrada.

## Configuração necessária

No arquivo `.env` da raiz, preencha somente a chave privada do Supabase do site:

```env
SITE_SUPABASE_URL=https://uesqdbaxhnblefrtjtae.supabase.co
SITE_SUPABASE_SERVICE_ROLE_KEY=cole_a_service_role_key_do_supabase
```

A chave deve ser a `service_role` do mesmo projeto usado por `4core.site`. Ela não pode ser colocada em variáveis `VITE_*`, no frontend ou em commits.

Depois reinicie a API. Com uma sessão autenticada no ERP, o dashboard consulta `GET /site/dashboard?days=30`; o CRM usa a mesma fonte com os leads dos últimos 90 dias.

## Segurança

A rota exige o JWT do ERP e o Supabase é chamado apenas pelo FastAPI. Se a fonte não estiver configurada, o ERP mantém a interface funcional, sem exibir dados fictícios como se fossem dados do site.
