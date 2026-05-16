---
name: Triage AI Training & Learning
description: Gisele agora usa prompt editável (company_settings.triage_system_prompt + departments.triage_prompt) e aprende com exemplos de triage_learnings
type: feature
---
- `company_settings.triage_system_prompt` — prompt completo da Gisele (editável em Configurações → Empresa). Suporta `{agent_name}`. Se vazio, edge function usa DEFAULT_SYSTEM_PROMPT codado.
- `departments.triage_prompt` — instrução por departamento (substitui `triage_keywords` na UI; keywords mantidas como fallback).
- Tabela `triage_learnings`: registra cada `transfer` da Gisele com `outcome` (`auto_confirmed`/`corrected`/`rejected`), `chosen_department_id`, `corrected_department_id`.
- Edge function `triage-learning-reconcile` roda a cada 5 min (cron pg_cron job `triage-learning-reconcile`). Após 30 min de criado, verifica `chat_conversations.assigned_to` → `profiles.department_id`; se diferente do `chosen_department_id` marca `corrected`.
- `chat-triage-agent` injeta até 8 exemplos mais recentes balanceados por departamento no system prompt como few-shot.
- Aba "Treinamento Gisele" em Settings mostra métricas + lista de aprendizados + botão "Esquecer".
