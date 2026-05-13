## Alerta WhatsApp para conversas em Espera (>10 min)

### Comportamento
- Verifica a cada 1 minuto as conversas com `status='open'`, `assigned_to IS NULL` e `waiting_since` há mais de 10 minutos.
- Envia mensagem ao grupo configurado (Evolution API) com nome do contato/grupo, telefone, tempo de espera e link para a conversa.
- Reenvia a cada 10 min enquanto continuar sem atendimento (1º aviso aos 10', 2º aos 20', etc.).
- Quando a conversa for atribuída, o trigger existente já zera `waiting_since` e os alertas param.

### Banco
1. **`company_settings`** — adicionar coluna `chat_alert_whatsapp_group_id text` para guardar o JID do grupo escolhido nas Configurações.
2. **`chat_conversations`** — adicionar coluna `last_wait_alert_at timestamptz` para controlar quando foi enviado o último alerta (base para o reforço a cada 10 min).
3. **CRON** — `pg_cron` chamando uma Edge Function a cada 1 minuto.

### Edge Function `chat-waiting-alert`
- Lê `company_settings.chat_alert_whatsapp_group_id`. Se vazio → no-op.
- Busca conversas `open` + `assigned_to IS NULL` + `waiting_since <= now() - 10 min` + (`last_wait_alert_at IS NULL` OR `last_wait_alert_at <= now() - 10 min`).
- Para cada uma: monta texto (`⚠️ Conversa aguardando atendimento há X minutos — Nome (telefone)`) e envia via Evolution API `/message/sendText/{instance}` para o JID do grupo.
- Atualiza `last_wait_alert_at = now()`.

### UI — Configurações → Empresa
Novo bloco "Alertas de Chat" com Combobox que lista grupos via `evolution-list-groups` (já existente) e salva o JID em `chat_alert_whatsapp_group_id`. Botão para limpar (desativa o alerta).

### Detalhes técnicos
- Reaproveita secrets `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`.
- Cron via `pg_cron` + `pg_net.http_post` (mesmo padrão do `trg_notify_chat_message`).
- `verify_jwt = false` para a função (chamada por cron, sem usuário).
- Sem alteração nos triggers existentes de `waiting_since`.
