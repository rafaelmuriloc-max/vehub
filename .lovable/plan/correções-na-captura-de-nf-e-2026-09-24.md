# Correções na captura de NF-e

## O que muda para o usuário
- Eventos (ciência, cancelamento etc.) deixam de apagar os dados das notas.
- Notas já estragadas são recuperadas (com contagem mostrada antes).
- Quando a SEFAZ bloquear (137/656), a tela mostra "Próxima consulta liberada às HH:MM".
- Busca por período passa a filtrar o que já está gravado, sem gastar cota da SEFAZ.
- A busca diária deixa de pular empresas com nome igual.

## Etapas

### 1. Eventos em tabela própria (crítico)
- Migration: tabela `nfe_events` (id, client_id, access_key, tp_evento, n_seq_evento, dh_evento, descricao, nsu, raw_xml, created_at), unique(access_key, tp_evento, n_seq_evento), GRANTs + RLS iguais às de `nfe_invoices` (policies copiadas após leitura).
- `nfe-query`: detecção de evento sem diferenciar maiúsculas pelo schema (`/evento/i`) e pelo conteúdo (`<resEvento`, `<procEventoNFe`), no parse do lote (linha ~233) e no `parseNfeEntry` (linha ~507).
- Eventos vão só para `nfe_events` (upsert na unique, dedup por lote). Na `nfe_invoices` apenas: tpEvento 110111 -> `update status='cancelada' where access_key=...` (sem upsert, sem outros campos). Remover o ramo `status = evento_XXX`.
- Mantida a regra que impede rebaixar nota `xml_baixado` para resumo.
- Recuperação (em duas fases):
  1. Consulta só leitura com a contagem: linhas `status like 'evento_%'` ou `issue_date is null`/`total_value = 0`, separadas em: com XML no Storage `documents/nfe/{client_id}/{access_key}.xml`, com raw_xml nfeProc/resNFe, com raw_xml de evento, sem fonte. Resultado apresentado a você antes de qualquer alteração.
  2. Após seu OK: edge function temporária `nfe-recover-events` (admin) que re-parseia e restaura (xml_baixado se houver XML completo, senão autorizada), move raw_xml de evento para `nfe_events` e reaplica cancelamentos. Removida depois do uso.

### 2. Certificado correto na manifestação
- Novo `supabase/functions/_shared/certificate.ts` com `parsePfx`: casa o certificado pelo localKeyId da chave; fallback pelo publicKey (módulo) igual ao da chave; retorna certPem, keyPem, privateKey.
- `nfe-query` e `nfe-manifestacao` passam a usar esse helper.

### 3. Controle de bloqueio por CNPJ
- Migration: `clients.nfe_next_query_at timestamptz`.
- `nfe-query`: antes de consultar, se `nfe_next_query_at > now()` retorna `{ skipped: true, next_query_at }` sem chamar a SEFAZ. Ao receber 137 ou 656: grava ultNSU retornado e `nfe_next_query_at = now() + 1h`.
- `nfe-auto-complete` repassa `skipped/next_query_at`.
- `NfeTab.tsx`: na consulta manual, toast/aviso "Próxima consulta liberada às HH:MM" para as empresas puladas.

### 4. Sem reconsulta pós-manifestação
- Remover a etapa (d) do `nfe-auto-complete` (e o parâmetro wait_seconds). O procNFe vem na próxima rodada. Manifestação automática continua para todos.

### 5. Período filtrado no banco
- `nfe-query`: remove date_from/date_to e o recomeço do NSU 0; sempre incremental por `last_nfe_nsu`.
- `NfeTab.tsx`: filtro de período aplicado na listagem de `nfe_invoices` (issue_date).
- Nova opção de consulta por chave (`consChNFe`) em `nfe-query` (parâmetro `access_key`), acionada por um campo "Buscar por chave" na tela NF-e; respeita o bloqueio do CNPJ.

### 6. Cursor do daily sync
- `nfe-nfse-daily-sync`: ordenar por `id` e usar `gt("id", cursor)`; cursor salvo = id do cliente.

## Fora do escopo
Proxy PHP e armazenamento da senha do certificado.

## Arquivos e migrations
- Migration A: tabela `nfe_events` (grants, RLS) + coluna `clients.nfe_next_query_at`.
- `supabase/functions/_shared/certificate.ts` (novo)
- `supabase/functions/nfe-query/index.ts`
- `supabase/functions/nfe-manifestacao/index.ts`
- `supabase/functions/nfe-auto-complete/index.ts`
- `supabase/functions/nfe-nfse-daily-sync/index.ts`
- `supabase/functions/nfe-recover-events/index.ts` (temporária)
- `src/components/invoices/NfeTab.tsx`

## Validação
`bunx tsgo --noEmit` + build, deploy das funções, teste na Pizzaria Baú do Tesouro e conferência da contagem antes/depois da recuperação.
