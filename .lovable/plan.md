## Objetivo

Disparar cada agendamento **no minuto exato** configurado (no fuso de São Paulo), em vez da janela de 30 minutos atual.

## Mudanças

1. **Cron a cada 1 minuto** (em vez de 15 min)
   - Recriar o job `scheduled-messages-runner` com schedule `* * * * *`.
   - Continua chamando a mesma Edge Function via `net.http_post`.

2. **Janela de envio rígida na Edge Function**
   - Em `supabase/functions/scheduled-messages-runner/index.ts`, substituir a checagem `diff >= 0 && diff <= 30` por `diff === 0` (hora e minuto atuais em BRT == `send_time` do agendamento).
   - Mantém idempotência: se já existe `scheduled_message_runs` para o agendamento no dia, não dispara de novo (apenas reprocessa entregas `failed` se houver).
   - Mantém recorrência, antecipação de feriado/fds e fuso `America/Sao_Paulo`.

3. **Recuperação de falhas pontuais**
   - Se o cron atrasar um minuto (raro), o agendamento daquele dia ficará perdido pelo critério estrito. Para evitar isso, aceitar também `diff` entre 0 e 2 minutos como gatilho válido (apenas para tolerar latência do cron), continuando a impedir duplicidade pelo registro de run do dia.

4. **Validação**
   - Após o ajuste, conferir `cron.job` e `cron.job_run_details` para garantir execução de minuto em minuto.
   - Acompanhar `scheduled_message_runs` e `scheduled_message_deliveries` no horário do próximo agendamento (12:40 SP do dia atual já passou — testar com um novo horário próximo).

## Arquivos / recursos afetados

- Migration nova: `cron.unschedule('scheduled-messages-runner')` + `cron.schedule('scheduled-messages-runner', '* * * * *', ...)`.
- `supabase/functions/scheduled-messages-runner/index.ts`: ajuste da janela (de 0–30 min para 0–2 min) na seção `Time check`.

## Observação

O agendamento de hoje às 12:40 não vai mais executar (horário já passou). Para testar, basta cadastrar um novo agendamento alguns minutos no futuro.