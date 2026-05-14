---
name: AI Triage Agent
description: Gisele faz primeiro atendimento, classifica departamento e atribui round-robin
type: feature
---
Edge function `chat-triage-agent` é disparada (fire-and-forget) pelo `whatsapp-webhook` quando chega mensagem de cliente em conversa sem `assigned_to`, não-grupo, com `triage_status` em `pending|in_progress`.

- Liga/desliga em `company_settings.triage_enabled`. Quando ligado, a resposta off-hours genérica fica desativada.
- Departamentos têm campo `triage_keywords` (textarea em DepartmentsTab) usado pela IA para decidir.
- Usa Lovable AI Gateway (`google/gemini-2.5-flash`) com tool calling: `ask_user(text)` ou `transfer(department_id, summary)`.
- Limite de 5 turnos da Gisele; após isso transfere para `triage_fallback_department_id`.
- Mensagens enviadas via `whatsapp-send-text` com `senderName = company_settings.agent_name` (assina "*Gisele:*").
- Round-robin: escolhe profile com `department_id = X` que tem menos `chat_conversations` abertas atribuídas.
- Estados em `chat_conversations`: `triage_status` (`pending|in_progress|done|skipped`), `triage_department_id`, `triage_summary`, `triage_turns`.
- Conversas pré-existentes ficam `skipped` na migration para não serem retriaged.
- Claim atômico via `update ... where triage_status in (pending,in_progress) and assigned_to is null` evita resposta duplicada por race no webhook.
