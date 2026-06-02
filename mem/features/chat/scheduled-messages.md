---
name: Scheduled Chat Messages
description: Agendamento de mensagens automáticas WhatsApp para clientes via cron pg_cron
type: feature
---
Tabelas: `scheduled_messages`, `scheduled_message_clients`, `scheduled_message_runs`, `scheduled_message_deliveries`.
Runner: edge function `scheduled-messages-runner` chamada via pg_cron a cada 15 min.
Recurrence: daily/weekly/monthly/quarterly/yearly/custom_months. Quando cair em fim de semana/feriado e `anticipate_weekend=true`, antecipa para dia útil anterior.
Modos de atribuição (mesmo padrão das obrigações): all, segment (filters jsonb), manual (via tabela join).
Destinatário: `client_department_contacts(department_id)` primeiro, fallback no `clients.contact_phone`.
Envio prefere Evolution API (fora da janela 24h Meta); registra no chat do cliente como `whatsapp_outgoing`/`whatsapp_image`/etc com `agent_name='Agendador'` e marker VHUB.
Idempotência: chave (`scheduled_message_id`, `run_at` truncado ao meio-dia UTC).
Anexos no bucket `chat-media` sob `scheduled/`.
Acesso: admins criam/editam/excluem; demais usuários visualizam pelos departamentos a que pertencem.