# Mostrar a meta do ISS no dia 07/09 no calendário

## Causa

O ISS tem três datas: alerta (dia 5), meta (dia 7) e vencimento (dia 10). Hoje o calendário antecipa **todas** as três para o dia útil anterior quando caem em fim de semana ou feriado. Em setembro/2026:

- Alerta 05/09 é sábado → vai para 04/09
- Meta 07/09 é feriado (Independência) → também vai para 04/09
- Como as duas caem no mesmo dia, o calendário mostra só uma marcação em 04/09 e nada em 07/09

O vencimento (10/09) está correto. Nas outras telas do sistema (Obrigações, aba de obrigações do cliente) só o **vencimento** é antecipado; alerta e meta ficam no dia cadastrado.

## Correção

No calendário, antecipar para o dia útil anterior **apenas o vencimento**. Alerta e meta passam a aparecer exatamente no dia cadastrado (05/09 e 07/09), alinhando com o restante do sistema.

Resultado para o ISS de setembro: alerta em 05/09, meta em 07/09, vencimento em 10/09.

## Detalhes técnicos

- `src/pages/CalendarView.tsx`
  - Eventos do calendário (~linhas 286-305): `makeDate` deixa de aplicar `previousBusinessDay` para `alert_day` e `target_day`; mantém a antecipação só para `due_day` (usado apenas quando a instância não tem `due_date`).
  - Cards de métricas (~linhas 1022-1048): mesma regra — alerta e meta sem antecipação, vencimento com.
  - `getInstanceDueDate` (~linha 521) não muda (é só vencimento).
- Nenhuma alteração de banco, dados ou edge functions.

## Validação

- Calendário de setembro/2026 com filtro ISS: marcações em 05/09 (alerta), 07/09 (meta) e 10/09 (vencimento).
- Outubro/2026: alerta 05/10, meta 07/10, vencimento 09/10 (dia 10 é sábado).
