

# Plano: Filtro de período com presets (Esse Mês, Mês Anterior, etc.)

## Alteração

Substituir os dois inputs de data (`De` / `Até`) por um **Select de período** com as opções:
- **Esse Mês** — primeiro e último dia do mês atual
- **Mês Anterior** — primeiro e último dia do mês anterior
- **Esse Ano** — 1º de janeiro até hoje
- **Ano Anterior** — 1º de janeiro a 31 de dezembro do ano anterior
- **Personalizado** — exibe os dois inputs de data (comportamento atual)
- **Todos** (valor padrão) — sem filtro de data

### Em `src/pages/Invoices.tsx`:

1. **Novo estado** `datePeriod` com valores `'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'`, default `'all'`.

2. **Função helper** `getDateRange(period)` que retorna `{ from: string, to: string }` calculando as datas com base no período selecionado.

3. **Ao mudar `datePeriod`**: se não for `'custom'`, calcular e setar `filterDateFrom`/`filterDateTo` automaticamente. Se for `'custom'`, manter os valores atuais para edição manual. Se for `'all'`, limpar ambos.

4. **UI**: Trocar os dois inputs de data por um Select de período. Os inputs de data só aparecem quando `datePeriod === 'custom'`.

```
[Select: Período ▼]  [De: ____] [Até: ____]   [Select: Cliente ▼]
                      ↑ só visível se "Personalizado"
```

