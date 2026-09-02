# Integração API ADN — Eventos de NFS-e

## Contexto

A documentação oficial (Manual de Contribuintes — APIs do ADN, v1.0 de 12/02/2026) define duas APIs:

- `GET /DFe/{NSU}` — distribuição de DF-e por NSU → **já implementada** em `nfse-query` (sync diário às 6h).
- `GET /NFSe/{ChaveAcesso}/Eventos` — consulta de eventos vinculados a uma NFS-e pela chave de acesso → **não implementada**.

Hoje o sistema só detecta cancelamentos quando o evento aparece na distribuição por NSU. O plano é completar a integração ADN com a consulta de eventos por chave de acesso, com atualização automática do status das notas.

## O que será construído

### 1. Nova tabela `invoice_events` (migration)
- Campos: `invoice_id` (FK invoices), `access_key`, `event_type` (ex.: cancelamento, substituição), `event_description`, `event_date`, `xml` (evento completo), `raw_data` (jsonb).
- Unique em (`access_key`, `event_type`, `event_date`) para idempotência.
- GRANTs (authenticated + service_role), RLS por empresa do usuário (mesmo padrão de `invoices`).

### 2. Edge function `nfse-events`
- Input: `invoice_id` (unitário) ou `client_id` + `days` (lote, ex.: notas dos últimos N dias).
- Baixa certificado A1 do cliente (com retry, padrão já usado), abre conexão mTLS com `https://adn.nfse.gov.br/contribuintes/NFSe/{ChaveAcesso}/Eventos`.
- Faz parse dos eventos retornados, grava em `invoice_events` e atualiza `invoices.status`:
  - evento de cancelamento → `cancelada`
  - evento de substituição → `substituida`
- Rate limit: 2s entre requisições; aborta lote em 429 com resumo parcial.
- Respostas de erro padronizadas (503 para indisponibilidade do ADN com mensagem de retry).

### 3. Interface (aba NFS-e)
- Coluna/ação por nota: botão "Eventos" que consulta sob demanda e abre dialog com a lista de eventos (tipo, data, descrição).
- Botão no topo "Atualizar status (eventos)" que roda a verificação em lote para as notas do período filtrado, com progresso e resumo (X canceladas, Y substituídas).
- Badge de status já existente passa a refletir também `substituida`.

### 4. Sincronização diária
- No `nfe-nfse-daily-sync`, após a distribuição por NSU, verificar eventos das notas dos últimos 30 dias ainda marcadas como `normal` (respeitando rate limit).

## Detalhes técnicos
- mTLS: reuso do helper de `nfse-query` (cert/key PEM via node-forge + conexão TLS), compartilhado em `supabase/functions/_shared` se necessário.
- Ambiente: produção (`adn.nfse.gov.br`); o swagger de produção restrita exige certificado e não é acessível do sandbox — os parses seguirão o manual + tolerância a variações de schema (mesmo padrão defensivo já usado no parse da distribuição).
- CNPJ raiz: o manual permite consultar com certificado de mesmo CNPJ raiz via parâmetro — mantemos o certificado do próprio cliente (cenário atual).
- Validação: typecheck + build; teste real depende de certificado válido no ambiente publicado.
