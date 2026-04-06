

# Cards de controle de obrigações no Calendário

## O que será feito
Adicionar uma seção com 5 cards de métricas entre os filtros e o calendário, mostrando o total de obrigações do mês por status:

1. **A Fazer** — instâncias pendentes (não concluídas), antes da data de alerta
2. **Após Início** — pendentes que já passaram da data de alerta (alert_day)
3. **Após Meta** — pendentes que já passaram da data meta (target_day)
4. **Atrasadas** — pendentes que já passaram do vencimento (due_day)
5. **Concluídas** — separadas em "No Prazo" (concluídas até o due_day) e "Fora do Prazo"

## Alterações em `src/pages/CalendarView.tsx`

### 1. Computar métricas via `useMemo`
Iterar sobre as `instances` do mês, verificar se cada instância está concluída (todas as atividades completas), e classificar com base na data atual vs alert/target/due (usando `previousBusinessDay` para dias úteis):

- `todo`: pendente, hoje < alertDate
- `afterAlert`: pendente, hoje >= alertDate e hoje < targetDate
- `afterTarget`: pendente, hoje >= targetDate e hoje < dueDate
- `overdue`: pendente, hoje >= dueDate
- `doneOnTime`: concluída, última completion_at <= dueDate
- `doneLate`: concluída, última completion_at > dueDate

### 2. Renderizar cards
Inserir 5 cards em grid `grid-cols-2 md:grid-cols-5` entre o bloco de filtros (linha ~580) e o calendário (linha ~582). Cada card com ícone, título, total e cor temática:

- A Fazer: azul (ListChecks)
- Após Início: amarelo (Clock)
- Após Meta: laranja (AlertTriangle)
- Atrasadas: vermelho (AlertTriangle)
- Concluídas: verde (CheckSquare) com subtexto "X no prazo / Y fora"

### 3. Imports
Adicionar `AlertTriangle` ao import do lucide-react (já existe `Clock`, `CheckSquare`, `ListChecks`).

## Arquivo
- `src/pages/CalendarView.tsx` — ~50 linhas adicionadas (useMemo + cards)

