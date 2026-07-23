## Objetivo

No calendário, o rótulo de competência de obrigações trimestrais deve ser o mês final do trimestre no formato `MM/AAAA` (ex.: `03/2026`, `06/2026`, `09/2026`, `12/2026`) em vez de `Q1/2026`, `Q2/2026`, etc.

## Contexto

Hoje, em `src/pages/CalendarView.tsx`, quando `obligation.recurrence === 'trimestral'` o rótulo é montado como `` `Q${quarter}/${year}` ``. O `reference_month` das instâncias trimestrais já é armazenado no mês final de cada trimestre (03, 06, 09, 12), então basta usar mês/ano do próprio `reference_month`.

## Alterações

Apenas frontend, em `src/pages/CalendarView.tsx`:

1. Builder de eventos (por volta da linha 260):
   - Substituir:
     ```ts
     const competenceLabel = obl.recurrence === 'trimestral'
       ? `Q${Math.floor(compDate.getMonth() / 3) + 1}/${compDate.getFullYear()}`
       : `${compMonthNames[compDate.getMonth()]}/${compDate.getFullYear()}`;
     ```
   - Por:
     ```ts
     const mm = String(refDate.getMonth() + 1).padStart(2, '0');
     const yyyy = refDate.getFullYear();
     const competenceLabel = obl.recurrence === 'trimestral'
       ? `${mm}/${yyyy}`
       : `${compMonthNames[compDate.getMonth()]}/${compDate.getFullYear()}`;
     ```
   - Para trimestrais o rótulo passa a ser o mês final do trimestre (o próprio `reference_month`), ignorando `competence_rule`.

2. Aplicar a mesma lógica no segundo ponto que monta `competenceLabel` (~linha 381) e no título do diálogo de detalhes (~linha 1576), trocando o `` `Q${...}/${...}` `` por `` `${MM}/${YYYY}` `` derivado de `reference_month`.

Nenhuma alteração em banco, edge functions ou fluxo de geração de instâncias.
