## Objetivo
Exibir e baixar NF-e de saída (emitidas pelo próprio cliente) usando o mesmo `nfeDistribuicaoDFe` já em produção. O serviço entrega tanto entradas quanto saídas para o CNPJ interessado; hoje todas são salvas, mas a UI só mostra como "recebidas".

## Mudanças

### 1. Schema (migration)
- Adicionar coluna `direction text not null default 'entrada'` em `nfe_invoices` (valores: `entrada` | `saida`).
- Backfill: `update nfe_invoices set direction = 'saida' where regexp_replace(emitter_cnpj, '\\D', '', 'g') = (select regexp_replace(document, '\\D', '', 'g') from clients where clients.id = nfe_invoices.client_id);`

### 2. `supabase/functions/nfe-query/index.ts`
- Em `parseNfeEntry`, calcular `direction`:
  - Normalizar `emitterCnpj` e `clientDoc` (só dígitos).
  - Se iguais → `direction = 'saida'`; caso contrário → `'entrada'`.
- Incluir `direction` no payload de upsert.

### 3. `supabase/functions/nfe-download/index.ts`
- Já funciona para saídas (consulta por chave no AN). Sem alterações.

### 4. `src/components/invoices/NfeTab.tsx`
- Adicionar **abas** "Entradas" / "Saídas" (Tabs do shadcn) acima do filtro existente.
- Estado `directionTab: 'entrada' | 'saida'` aplicado ao `filteredInvoices`.
- Manter contadores nas abas (`Entradas (N)` / `Saídas (M)`).
- Header "NF-e Recebidas" muda dinamicamente para "NF-e Emitidas" quando aba=saida.
- Bulk download (XML/PDF) já respeita `filteredInvoices`, então funciona automaticamente para a aba ativa.
- Coluna "Emitente" troca para "Destinatário" quando aba=saida (mostra `recipient_name` em vez de `emitter_name`).

### 5. `src/integrations/supabase/types.ts`
- Regenerado automaticamente após a migration.

## Resultado
- Sincronização única continua trazendo todas as NF-e do CNPJ; classificação automática entrada/saída.
- UI com abas claras separando recebidas e emitidas.
- Download individual e em lote funcionam para ambas.
