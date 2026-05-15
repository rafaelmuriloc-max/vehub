---
name: Awaiting First Reply
description: Atribuídas (Gisele/manual) vão direto para Chat do atendente; cronômetro fica visível em qualquer aba até a 1ª resposta
type: feature
---
- Coluna `chat_conversations.awaiting_first_reply` (bool, default false). Trigger BEFORE UPDATE seta true ao atribuir e false ao desatribuir; trigger AFTER INSERT em `chat_messages` zera quando o atendente envia a 1ª mensagem `text`/`whatsapp_outgoing`.
- Conversas atribuídas (Gisele ou manual) caem direto na aba **Chat** do atendente — não vão para Espera. A aba **Espera** (`in_progress`) lista apenas chamados sem atendente (`assigned_to IS NULL`).
- Enquanto `awaiting_first_reply=true`, o `WaitingBadge` (cronômetro colorido) aparece em qualquer aba (Chat, Espera, Geral) e some assim que o atendente envia a 1ª mensagem.
- O `chat-inactivity-monitor` ignora conversas com `awaiting_first_reply=true` — auto-close de 30+5 min só conta após a 1ª resposta.
