---
name: Registro de Chamados (Help Desk)
description: Tabela support_tickets, triggers de abertura/encerramento e resumo por IA das conversas do chat
type: feature
---
- Tabela `public.support_tickets`: `ticket_number` (sequência), `conversation_id`, `client_id`, contato, `department_id`, `assigned_to`, `status` (open/closed), `opened_at`/`closed_at`, `wait_seconds`, `handle_seconds`, `messages_count`, `subject`, `summary`, `category`, `summary_status` (pending/done/empty). Índice único parcial garante 1 chamado aberto por conversa.
- Triggers em `chat_conversations`: `ticket_open_on_conversation` (AFTER INSERT) abre chamado; `ticket_sync_on_conversation` (AFTER UPDATE) encerra ao fechar (grava tempos + dispara `net.http_post` para `ticket-summarize`), abre novo chamado na reabertura e sincroniza responsável/departamento.
- Edge function `ticket-summarize` (verify_jwt=false): `{ticket_id}` gera resumo via Lovable AI Gateway (`google/gemini-2.5-flash`, tool `registrar_resumo`); `{backfill:true, since, limit}` cria chamados retroativos das conversas com mensagens no período e resume pendentes em lote (usar limit ~8 para não estourar timeout).
- UI: página `/tickets` (`src/pages/Tickets.tsx`) com filtros (período, situação, responsável, departamento, busca), paginação e dialog de detalhe; botão "Ver chamados" no card Chamados do Dashboard e item "Chamados" na sidebar.
