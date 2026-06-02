## Fuso horário São Paulo nos agendamentos

O runner (`scheduled-messages-runner`) **já** opera em `America/Sao_Paulo` via `nowInBRT()` — a hora salva (`send_time`) é interpretada como horário de Brasília e o cron compara com a hora atual em SP. Não há mudança de lógica necessária no backend.

O que falta é apenas deixar a UI explícita e consistente com esse fuso:

## Alterações em `src/pages/ScheduledMessages.tsx`

1. **Label do campo de hora**: trocar "Hora (BRT)" por "Hora (fuso de São Paulo)" e adicionar nota curta: "O disparo respeita o horário de Brasília (America/Sao_Paulo)".
2. **Coluna "Hora" da tabela**: anexar `(São Paulo)` em texto pequeno ao lado do horário.
3. **Datas exibidas** (`last_run_at` na tabela e `run_at` no histórico): forçar `toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })` para não depender do fuso do navegador.

Sem mudanças de schema, RLS, runner ou cron.
