## Restringir alertas de chat ao horário de atendimento

Modificar a edge function `chat-waiting-alert` para só disparar alertas no grupo do WhatsApp quando o momento atual estiver dentro do horário de atendimento configurado em `company_settings` e em dia útil (seg–sex, fora de feriado nacional).

### Mudanças

**`supabase/functions/chat-waiting-alert/index.ts`**
- Carregar de `company_settings` os campos: `service_hours_enabled`, `service_open_time`, `service_close_time`, `service_lunch_start`, `service_lunch_end`, `service_timezone` (junto com `chat_alert_whatsapp_group_id` que já é lido).
- Antes de buscar conversas em espera, calcular `now` no `service_timezone` (default `America/Sao_Paulo`).
- Pular execução (retornar `{ ok: true, skipped: "off_hours" }`) quando:
  - dia da semana for sábado/domingo, ou
  - data atual for feriado nacional (porta inline da lógica de `src/lib/holidays.ts` — algoritmo de Páscoa de Meeus + lista fixa), ou
  - `service_hours_enabled = true` e a hora atual estiver fora do intervalo `service_open_time`–`service_close_time`, ou dentro de `service_lunch_start`–`service_lunch_end` (quando preenchidos).
- Se `service_hours_enabled = false` ou as horas não estiverem configuradas, manter apenas o filtro de dia útil + feriado (seg–sex). 

### Comportamento

- Conversas que entraram em espera fora do horário acumulam tempo normalmente, mas o alerta só dispara quando o expediente reabre (a checagem do `last_wait_alert_at` continua valendo).
- Nada muda na UI, no banco ou no fluxo de resposta automática do agente — apenas o alerta de espera passa a respeitar o expediente.
