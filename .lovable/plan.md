## Objetivo
Quando o usuário logado enviar qualquer resposta (texto, imagem, vídeo, arquivo, localização ou contato) em uma conversa, o chamado deve ser automaticamente atribuído a ele — sempre, mesmo que já estivesse com outro responsável.

## Implementação

**Arquivo:** `src/pages/Chat.tsx`

Criar um helper `ensureAssignedToMe(convId)` que:
1. Faz `update` em `chat_conversations` setando `assigned_to = user.id` e `updated_at = now()` para o `id` informado.
2. Garante que o usuário também esteja em `chat_participants` (insert se não existir), para não quebrar políticas RLS de update futuras.

Chamar esse helper no início de cada uma das 4 funções de envio:
- `sendMessage`
- `sendMedia`
- `sendLocation`
- `sendContact`

A chamada acontece antes do envio (Edge Function ou insert). Após o envio, `loadConversations()` já é disparado pelo realtime, atualizando a etiqueta de responsável na lista.

**Observações:**
- Não muda quando `status = 'closed'` porque o envio já é bloqueado nesse caso.
- Mantém a lógica de transferência manual existente intacta.
- Não toca em backend / edge functions / RLS (políticas atuais já permitem update por participante).
