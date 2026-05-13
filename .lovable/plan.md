## Configuração de horário e agente de atendimento

### 1. Banco — `company_settings` (nova migration)
Adicionar colunas:
- `service_hours_enabled boolean default false`
- `service_open_time time` (ex.: 08:00)
- `service_close_time time` (ex.: 18:00)
- `service_lunch_start time` (opcional)
- `service_lunch_end time` (opcional)
- `service_timezone text default 'America/Sao_Paulo'`
- `agent_name text` — nome exibido como assinatura do agente automático
- `agent_offhours_message text` — mensagem enviada fora do horário
- `agent_offhours_last_sent jsonb default '{}'` — para deduplicar resposta automática por contato (chave = phone, valor = timestamp ISO)

Sem alteração de RLS (já é admin-only para update).

### 2. UI — `src/components/settings/CompanyTab.tsx`
Novo card **"Horário de Atendimento e Agente Virtual"**, abaixo do card de Alertas de Chat:

- Switch *Ativar resposta automática fora do horário*.
- Inputs `time`: Abertura, Fechamento.
- Inputs `time` opcionais: Início do almoço, Fim do almoço (com checkbox "Tem pausa de almoço").
- Texto fixo: "Aplicado de segunda a sexta. Sábados, domingos e feriados nacionais ficam como fora do horário."
- Input `Nome do agente` (ex.: "Atendimento Velocitä").
- Textarea `Mensagem fora do horário` com placeholder e dica das variáveis disponíveis: `{nome_agente}`, `{horario}`.
- Botão Salvar (admin-only).

### 3. Edge Function — `whatsapp-webhook` (responder fora do horário)
Após inserir a mensagem recebida (linha ~490), e somente quando:
- `message.message_type` é de entrada (não `whatsapp_outgoing` / `text`),
- conversa está `status='open'` e `assigned_to IS NULL`,
- `company_settings.service_hours_enabled = true` e `agent_offhours_message` está preenchido,
- horário atual em `service_timezone` cai fora do intervalo configurado (fora do dia útil seg–sex, antes da abertura, depois do fechamento, ou dentro da pausa de almoço, ou em feriado nacional via `src/lib/holidays.ts` portado para Deno),
- e `agent_offhours_last_sent[phone]` é nulo ou tem mais de 6 h (anti-spam),

→ enviar via Meta API (`whatsapp-send-text` / mesmo helper já usado) o texto:
```
{agent_offhours_message com {nome_agente} e {horario} substituídos}
```
com o sufixo VHUB_MARKER (`\u200B\u200B\u200B`) para evitar eco, atualizar `agent_offhours_last_sent`, e registrar em `whatsapp_logs`.

Sem CRON novo — a checagem acontece no próprio webhook quando a mensagem chega.

### 4. Tipos
`src/integrations/supabase/types.ts` é regenerado automaticamente após a migration.

### Resumo do comportamento
Dentro do horário: sistema não responde sozinho (deixa para o atendente).
Fora do horário (incluindo almoço, fim de semana e feriados): primeira mensagem do contato recebe a resposta cadastrada, assinada com o nome do agente. Repetições do mesmo contato dentro de 6 h não disparam nova resposta automática.