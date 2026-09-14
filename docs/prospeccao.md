# Módulo de prospecção

O módulo `/comercial/prospeccao` organiza a busca, qualificação, distribuição e acompanhamento de empresas aderentes ao ICP da 4Core.

## Regra comercial implementada

- Empresas ativas abertas entre 3 e 24 meses, com prioridade entre 6 e 18 meses.
- Segmentos iniciais: saúde, transporte e logística, facilities, segurança, limpeza e operações por turno.
- Indícios de mais de cinco funcionários são tratados como estimativa, nunca como dado confirmado.
- Até três comerciais recebem cinco prospectos por dia útil.
- A equipe revisa os dados e faz a primeira abordagem. O envio de e-mail só é liberado depois que o interesse ou a autorização é registrado no ERP.
- Depois do primeiro e-mail, os lembretes são enviados em 3 e 5 dias úteis e interrompidos quando chega uma resposta.
- Pedidos de descadastro entram em uma lista permanente de não contato.

## Integrações

### Casa dos Dados

Crie uma chave da API e configure `CASA_DOS_DADOS_API_KEY`. A campanha possui limite rígido de R$ 50,00 por mês e registra o consumo estimado antes de continuar as buscas.

Os CNPJs retornados pela busca são enriquecidos pela BrasilAPI. A BrasilAPI não substitui a fonte contratada nem confirma quantidade de funcionários.

### Hostinger

Configure a caixa `comercial@4core.site` com:

```text
HOSTINGER_EMAIL_ADDRESS=comercial@4core.site
HOSTINGER_EMAIL_PASSWORD=<senha da caixa>
HOSTINGER_SMTP_HOST=smtp.hostinger.com
HOSTINGER_SMTP_PORT=465
HOSTINGER_IMAP_HOST=imap.hostinger.com
HOSTINGER_IMAP_PORT=993
```

Mantenha `PROSPECTING_DRY_RUN=true` no primeiro teste. Quando um envio real controlado tiver sido validado, altere para `false`.

## Automação

Crie o mesmo valor aleatório e longo em dois locais:

1. `PROSPECTING_CRON_SECRET` no backend da Vercel.
2. Secret `PROSPECTING_CRON_SECRET` no repositório GitHub.

Os workflows executam:

- busca e distribuição às 09:00 (horário de São Paulo), de segunda a sexta;
- leitura da caixa e follow-ups a cada 30 minutos, das 09:00 às 18:30, de segunda a sexta.

As rotas automáticas exigem `Authorization: Bearer <segredo>` e não aceitam execução anônima sem o segredo correto.

## Importação da base antiga

A tela aceita CSV ou XLSX de até 10 MB e 5.000 linhas. Os cabeçalhos reconhecidos incluem CNPJ, razão social/empresa, nome fantasia, CNAE, atividade/ramo, data de abertura, porte, capital social, e-mail, telefone, município/cidade e UF/estado.

## Privacidade e operação segura

Antes de ativar o envio real, atualize a política em `https://4core.site/privacidade` para descrever a prospecção B2B com dados públicos, a base legal adotada, retenção, direitos do titular e canal de oposição. A lista de não contato deve ser mantida mesmo quando o restante do cadastro for removido, com os dados mínimos necessários para respeitar a oposição.
