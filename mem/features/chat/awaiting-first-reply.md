---
name: Awaiting First Reply
description: Conversas atribuídas (Gisele ou manual) ficam na aba Espera com tag do atendente até a 1ª resposta dele
type: feature
---
- Coluna `chat_conversations.awaiting_first_reply` (bool, default false).
- Trigger BEFORE UPDATE em chat_conversations: ao definir `assigned_to` (NULL→user ou user→user2), seta flag=true. Ao desatribuir, seta false.
- Trigger AFTER INSERT em chat_messages: se mensagem outgoing (`text`/`whatsapp_outgoing`) e `sender_id == assigned_to`, zera o flag.
- `get_chat_inbox`: aba `mine` exclui awaiting=true; aba `in_progress` (Espera) inclui assigned_to=NULL OU awaiting=true.
- UI: ConversationList já mostra badge colorido com nome do atendente quando assigned_to existe — funciona automaticamente para conversas em Espera vindas da triagem.
