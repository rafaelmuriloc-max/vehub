## Objetivo

Na tela de "Importar Documentos" (`ImportSetupDialog`), quando a obrigação selecionada for **Trimestral**, o campo de competência deve deixar de ser um seletor de mês (`YYYY-MM`) e passar a permitir escolher **Trimestre/Ano** (Q1..Q4/AAAA), exibido como `01/2026`, `02/2026`, `03/2026`, `04/2026` e assim por diante para cada ano.

## Comportamento

- Enquanto nenhuma obrigação estiver selecionada, ou a obrigação for mensal/anual: manter o input `type="month"` atual.
- Quando a obrigação selecionada tiver `recurrence = 'quarterly'` (Trimestral):
  - Trocar o input por dois seletores lado a lado: **Trimestre** (`01`, `02`, `03`, `04`) e **Ano** (ano atual ± alguns anos, ex.: atual−2 até atual+1).
  - Rótulo do trimestre no dropdown: `01/AAAA — Jan–Mar`, `02/AAAA — Abr–Jun`, `03/AAAA — Jul–Set`, `04/AAAA — Out–Dez` (o ano vem do seletor ao lado; label pode ser só `01 — Jan–Mar` no combo do trimestre para ficar curto).
  - Ao mudar de obrigação mensal→trimestral, converter o `referenceMonth` atual para o trimestre correspondente (mês 1–3 → Q1, 4–6 → Q2, etc.) e o ano do mês atual.
  - Ao mudar de trimestral→mensal, voltar ao mês atual (ou primeiro mês do trimestre selecionado).
- Ao confirmar, o `ImportContext.referenceMonth` continua sendo enviado no formato `YYYY-MM` esperado pelo restante do fluxo. Mapear trimestre → mês final do trimestre (03, 06, 09, 12), coerente com a convenção já usada no calendário para trimestrais:
  - Q1/AAAA → `AAAA-03`
  - Q2/AAAA → `AAAA-06`
  - Q3/AAAA → `AAAA-09`
  - Q4/AAAA → `AAAA-12`
- O `DocumentReviewDialog` continua recebendo `lockedReferenceMonth` no formato `YYYY-MM`; nenhuma alteração é necessária lá.

## Arquivos afetados

- `src/components/documents/ImportSetupDialog.tsx` — única alteração:
  - Detectar `selectedObligation.recurrence === 'quarterly'`.
  - Renderizar UI condicional de trimestre/ano no passo "2. Competência".
  - Manter estado interno `referenceMonth` como `YYYY-MM` (mês final do trimestre) para não quebrar o contrato com o chamador.
  - Conversão automática ao trocar a obrigação.

Nenhuma mudança em banco, edge functions, ou no fluxo posterior de revisão/importação.
