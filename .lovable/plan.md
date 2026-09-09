# Normalização dos regimes tributários

## Objetivo
Padronizar os valores armazenados em `clients.tax_regime` para os rótulos oficiais:
- `simples_nacional` → `Simples Nacional`
- `lucro_presumido` → `Lucro Presumido`

Manter `mei` e `lucro_real` inalterados (já estão em forma curta aceitável).

## Escopo
- Banco de dados: atualização dos registros existentes.
- Frontend: selects, filtros, exibição e lógica condicional que comparam `tax_regime`.
- Edge functions: queries e comparações que usam os valores antigos.

## Plano técnico

### 1. Banco de dados
- Criar migration SQL que executa:
  ```sql
  UPDATE public.clients
    SET tax_regime = CASE
      WHEN tax_regime = 'simples_nacional' THEN 'Simples Nacional'
      WHEN tax_regime = 'lucro_presumido' THEN 'Lucro Presumido'
      ELSE tax_regime
    END
    WHERE tax_regime IN ('simples_nacional', 'lucro_presumido');
  ```
- Migration somente de dados; não alterar tipo da coluna (permanece `text`).

### 2. Frontend
- Criar/utilizar constante centralizada para os valores oficiais, ex.:
  ```ts
  export const TAX_REGIME = {
    SIMPLES_NACIONAL: 'Simples Nacional',
    LUCRO_PRESUMIDO: 'Lucro Presumido',
    LUCRO_REAL: 'Lucro Real',
    MEI: 'MEI',
  } as const;
  ```
- Atualizar arquivos que declaram options locais para usar a constante:
  - `src/pages/Clients.tsx` (formulário, labels, gráfico, lógica de anexo)
  - `src/pages/ScheduledMessages.tsx`
  - `src/pages/Obligations.tsx`
  - `src/components/integra-contador/SituacaoFiscalTab.tsx` (filtro e exibição)
  - `src/components/simples-nacional/SimplesNacionalTab.tsx` (query `.in`)
- Substituir comparações literais (`=== 'simples_nacional'`) pela constante.
- Ajustar lógica de classificação automática (BrasilAPI) para gravar os novos valores.

### 3. Edge functions
- `supabase/functions/simples-nacional-sync/index.ts`: alterar `.in('tax_regime', ['simples_nacional', 'Simples Nacional'])` para comparar com o novo valor, usando normalização case-insensitive para compatibilidade.
- `supabase/functions/nfse-emit/index.ts`: manter a normalização `.toLowerCase()` já existente, garantindo que `"Simples Nacional"`, `"simples_nacional"` e variações continuem mapeando corretamente para `opSimpNac`.
- `supabase/functions/scheduled-messages-runner/index.ts`: garantir que filtros por `tax_regimes` funcionem com os novos valores (case-insensitive ou normalização).

### 4. Validação
- Executar `bunx tsc --noEmit` (ou `tsgo`) para typecheck.
- Verificar build no log de observabilidade.
- Deploy das edge functions alteradas.

## Não inclui
- Alteração de schema (coluna continua `text`).
- Mudança em regras de negócio fiscal (apenas rótulos/valores).
- Normalização de histórico em migrations antigas (são imutáveis).
