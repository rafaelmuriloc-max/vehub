## Causa

O calendário monta os eventos usando `obl.due_day` sobre o `reference_month` da instância:

```ts
const dueDate = makeDate(obl.due_day);  // dia fixo do mês da competência
```

Para obrigações **trimestrais** (ex.: IRPJ/CSLL):
- `obligations.due_day` foi ocultado no cadastro (fica `null`) — regra é "dia 30 do mês seguinte ao trimestre".
- `reference_month` da instância = último mês do trimestre (03, 06, 09, 12), mas o vencimento cai em **abril, julho, outubro ou janeiro do ano seguinte**.

Resultado: `makeDate(null)` retorna `null` → nenhum evento é gerado e a instância some do calendário. Além disso, o `loadData` só carrega instâncias com `reference_month` dentro do mês visível, então uma instância Q1 (ref 03/AAAA, venc 30/04/AAAA) nunca aparece quando você abre abril.

## Correção em `src/pages/CalendarView.tsx`

1. **Carregar `due_date` e `recurrence` já persistidos**
   - Adicionar `due_date` no `select` de `obligation_instances` (linha 183) e no tipo `Instance` (linha 25).
   - Adicionar `recurrence` no `select` de `obligations` (linha 185) e no tipo `Obligation`.

2. **Carregar instâncias também por `due_date` no mês visível**
   - Substituir a query única por dois lookups em paralelo (por `reference_month` e por `due_date` dentro de `[monthStart, monthEnd)`) e unir os resultados deduplicando por `id`. Isso garante que uma instância Q1 apareça em abril mesmo com `reference_month = 03`.

3. **Usar `inst.due_date` quando existir**
   - No `events` (a partir da linha 227) e no `deletedMonthEvents` (linha 355), preferir `inst.due_date` sobre o cálculo por `obl.due_day`.
   - Para trimestrais, não empurrar eventos `alert`/`target` (obrigação não tem esses dias configurados) — só `due`, na `inst.due_date`.

4. **Métrica mensal (linha 831 em diante)**
   - Trocar `makeDate(obl.due_day, inst.reference_month)` por `inst.due_date ?? makeDate(obl.due_day, inst.reference_month)` para contar overdue/on-time corretamente para trimestrais.

5. **Rótulo de competência para trimestral**
   - Onde hoje há `competence_rule === 'previous' ? m-1 : m` (linhas 250 e 368 e 1561), quando `obl.recurrence === 'trimestral'` gerar rótulo `Q{n}/AAAA` (n = trimestre do `reference_month`, ex.: ref 06/2026 → `Q2/2026`) em vez de "Jun/2026".

## Fora de escopo
- Sem alterações em `Obligations.tsx`, geração de instâncias ou schema.
- Cards de detalhe/atividades continuam usando o mesmo `reference_month`; só o posicionamento no calendário e o rótulo mudam.
