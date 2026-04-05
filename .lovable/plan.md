

# Feriados nacionais no calendário + antecipação de datas para dia útil

## O que será feito

1. **Criar utilitário de feriados nacionais brasileiros** (`src/lib/holidays.ts`)
   - Função `getHolidays(year: number): Set<string>` que retorna todas as datas no formato `YYYY-MM-DD`
   - Incluir feriados fixos (Ano Novo, Tiradentes, Trabalho, Independência, N.S. Aparecida, Finados, Proclamação da República, Natal) e móveis (Carnaval, Sexta-feira Santa, Corpus Christi — calculados via Páscoa/algoritmo de Gauss)
   - Função `isBusinessDay(dateStr: string, holidays: Set<string>): boolean` — retorna false se for sábado, domingo ou feriado
   - Função `previousBusinessDay(dateStr: string, holidays: Set<string>): string` — recua até encontrar dia útil

2. **Marcar feriados no calendário** (`CalendarView.tsx`)
   - Computar `holidays` via `useMemo` para o ano/mês atual
   - Na renderização de cada célula, se o dia for feriado, aplicar fundo cinza (`bg-gray-100 dark:bg-gray-800`) e opcionalmente mostrar o nome do feriado no tooltip/desktop

3. **Antecipar datas de vencimento e meta para dia útil anterior** (`CalendarView.tsx`)
   - No `useMemo` de `events`, ao calcular `alertDate`, `targetDate` e `dueDate` via `makeDate()`, aplicar `previousBusinessDay()` quando o dia cair em feriado ou fim de semana
   - Isso afeta apenas a **visualização no calendário** — os dados no banco permanecem inalterados

4. **Antecipar na geração de instâncias** (`Obligations.tsx` e `ClientObligationsTab.tsx`)
   - Ao construir `dueDate` durante a geração de instâncias, aplicar `previousBusinessDay()` para que o dado gravado já reflita o dia útil correto

## Detalhes técnicos

### Feriados nacionais incluídos
- Fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12
- Móveis (baseados na Páscoa): Carnaval (Páscoa - 47 dias), Sexta-feira Santa (Páscoa - 2), Corpus Christi (Páscoa + 60)

### Cálculo da Páscoa
Algoritmo de Meeus/Jones/Butcher para calcular a data da Páscoa de qualquer ano.

### Estilização dos feriados no grid
```
// Célula com feriado
bg-gray-100 dark:bg-gray-800 border-gray-300
```

### Antecipação
A função `previousBusinessDay` recua dia a dia enquanto `!isBusinessDay`, garantindo que sextas-feiras antes de feriados na segunda também sejam tratadas.

## Arquivos
- **Novo**: `src/lib/holidays.ts` (~60 linhas)
- **Editado**: `src/pages/CalendarView.tsx` (import + ~10 linhas no useMemo de events + ~3 linhas na célula do grid)
- **Editado**: `src/pages/Obligations.tsx` (import + ~4 linhas na geração de dueDate)
- **Editado**: `src/components/ClientObligationsTab.tsx` (mesmo ajuste)

