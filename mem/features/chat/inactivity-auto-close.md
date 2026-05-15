---
name: Chat Inactivity Auto-Close
description: Aviso de chamado inativo no grupo de WhatsApp e fechamento automático após 5 min sem nova interação
type: feature
---
Edge function `chat-inactivity-monitor` (cron `* * * * *`):

- Escopo: conversas com `status='open'` E `assigned_to IS NOT NULL`.
- Exceção: ignora conversas com `awaiting_first_reply=true` (atendente atribuído mas ainda sem 1ª resposta) — o timer só passa a valer após a 1ª mensagem do atendente.
- Inatividade: 30 min sem qualquer mensagem nova na conversa.
- Em horário comercial (`company_settings.service_hours_enabled` + open/close/lunch + dias úteis + feriados nacionais), envia aviso no `chat_alert_whatsapp_group_id` via Evolution API e grava `chat_conversations.last_inactivity_alert_at`.
- Fora do horário comercial: fecha o chamado silenciosamente (sem aviso).
- 5 min após o aviso: se a última mensagem ainda for anterior a `last_inactivity_alert_at` → fecha (`status='closed'`, `closed_at=now()`); caso contrário → zera `last_inactivity_alert_at` (cancela fechamento, permite novo ciclo).
- Mensagem: "*Chamado sem atividade*" com Atendente (`profiles.full_name`), Contato (`name` ou `whatsapp_phone`), Empresa (`clients.company_name`), minutos de inatividade.
