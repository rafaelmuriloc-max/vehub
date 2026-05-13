## Problema

Quando Dorothea abre uma conversa atribuída ao Rafael e envia uma mensagem, a função `ensureAssignedToMe` em `src/pages/Chat.tsx` (linhas 291–308) faz **primeiro** o `UPDATE chat_conversations SET assigned_to = user.id` e **depois** insere o participante.

Como a política RLS de UPDATE em `chat_conversations` exige que o usuário já seja participante:

```
USING (EXISTS (SELECT 1 FROM chat_participants
               WHERE conversation_id = chat_conversations.id
                 AND user_id = auth.uid()))
```

…o UPDATE é silenciosamente ignorado quando a Dorothea ainda não é participante da conversa do Rafael Murilo. A conversa continua atribuída ao Rafael mesmo depois da mensagem enviada.

## Correção

Inverter a ordem em `ensureAssignedToMe`:

1. Verificar/inserir o usuário atual em `chat_participants`.
2. Só depois executar o `UPDATE assigned_to = user.id`.
3. Tratar erro do update e exibir toast em caso de falha (para deixar de falhar silenciosamente no futuro).
4. Após o sucesso, recarregar a lista de conversas para refletir o novo responsável imediatamente na UI.

## Arquivo

- `src/pages/Chat.tsx` — reescrever `ensureAssignedToMe` (≈linhas 291–308).

## Fora de escopo

- Adicionar botão explícito "Puxar conversa".
- Reatribuir automaticamente ao abrir a conversa.
- Mudanças nas políticas RLS (a regra atual continua válida; o bug é apenas a ordem das operações no cliente).