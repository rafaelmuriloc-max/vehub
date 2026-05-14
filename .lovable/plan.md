## Aviso de chamado inativo + fechamento automático

Adicionar um novo monitor que avisa, no mesmo grupo de alertas (`chat_alert_whatsapp_group_id`), quando um chamado em atendimento ficar 30 minutos sem qualquer mensagem nova, e fecha automaticamente o chamado 5 minutos depois — apenas se continuar inativo.

### Regras

- **Escopo**: conversas com `status = 'open'` **e** `assigned_to IS NOT NULL`.
- **Inatividade**: tempo desde a última mensagem da conversa (qualquer remetente) ≥ 30 min.
- **Anti-spam**: cada chamado só recebe um aviso por ciclo de inatividade. Reusa o campo existente `chat_conversations.last_wait_alert_at` (já usado pelo alerta de espera). Para diferenciar os dois tipos, criamos um novo campo `last_inactivity_alert_at`.
- **Fechamento automático**: 5 minutos após o aviso, se a `última mensagem` ainda for anterior ao aviso (sem nova interação), atualiza `status = 'closed'` e `closed_at = now()`. Se houver nova mensagem nesse intervalo, cancela e zera `last_inactivity_alert_at` para permitir novo ciclo futuro.

### Mensagem postada no grupo

```
*Chamado sem atividade*

👤 Atendente: {full_name}
📞 Contato: {contact_name ou whatsapp_phone}
🏢 Empresa: {client.company_name ou "—"}
⏱️ Inatividade: {minutos} min

Seu chamado será fechado por tempo de inatividade.
```

### Implementação

1. **Migração** (`supabase--migration`):
  - `ALTER TABLE chat_conversations ADD COLUMN last_inactivity_alert_at timestamptz;`
2. **Edge Function** `chat-inactivity-monitor` (`supabase/functions/chat-inactivity-monitor/index.ts`):
  - Lê `company_settings.chat_alert_whatsapp_group_id`.
  - Modo padrão (sem param): varre conversas `open` + `assigned_to IS NOT NULL`. Para cada uma, busca a última `chat_messages.created_at`.
    - Se `now - last_msg >= 30 min` E (`last_inactivity_alert_at IS NULL` OR `last_inactivity_alert_at < last_msg`):
      - Envia mensagem ao grupo via Evolution API (`/message/sendText`).
      - Salva `last_inactivity_alert_at = now()`.
  - Modo `?action=close-check` (chamado pelo cron a cada minuto também): para conversas com `last_inactivity_alert_at` entre 5 e 10 min atrás:
    - Se a última mensagem ainda for anterior a `last_inactivity_alert_at` → fecha (`status='closed'`, `closed_at=now()`).
    - Caso contrário → zera `last_inactivity_alert_at`.
3. **Cron** (via `supabase--read_query` com `cron.schedule`, fora de migration por conter URL/anon):
  - `*/1 * * * *` chamando `chat-inactivity-monitor` (faz alerta + close-check no mesmo run).

### Arquivos afetados

- **Novo**: `supabase/functions/chat-inactivity-monitor/index.ts`
- **Migration nova**: adiciona `last_inactivity_alert_at` em `chat_conversations`
- **Cron**: agendamento via `pg_cron` (insert separado)
- **Memória**: nova entrada `mem://features/chat/inactivity-auto-close` + atualização do `index.md`

### Observações

- Não envia nada ao cliente diretamente — tudo fica no grupo de alertas, conforme escolhido.
- Não afeta o monitor de espera existente (`chat-waiting-alert`), que usa `waiting_since` e `last_wait_alert_at`.
- Respeita horário comercial?  **Sim, deve enviar somrente em horário comercial, caso esteja fora do horário feche o chamado sem enviar aviso**