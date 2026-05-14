## Diagnóstico

A função `reopenTicket` em `src/pages/Chat.tsx` (linhas 523–537) faz apenas:

```ts
await supabase
  .from('chat_conversations')
  .update({ status: 'open', closed_at: null })
  .eq('id', activeConvId);
```

Dois problemas que afetam funcionários (não admins):

1. **RLS bloqueia silenciosamente o UPDATE.** A policy "Participants can update conversations" exige que o usuário esteja em `chat_participants` da conversa. Quando o chamado foi fechado por outro atendente (ou quando o funcionário nunca enviou mensagem antes do fechamento), ele não é participante. O Supabase **não retorna erro** num UPDATE filtrado por RLS — retorna 0 linhas afetadas. Por isso o toast "Chamado reaberto com sucesso" aparece mesmo sem nada acontecer no banco.

2. **Mesmo se o UPDATE passasse, o chamado sumiria do funcionário.** `closeTicket` (linha 509) zera `assigned_to`. Após reabrir mantendo `assigned_to = null`, a conversa não volta para a aba "Meus" do funcionário — o `get_chat_inbox` filtra por atribuição. O usuário vê o toast mas a conversa some / continua aparentando fechada.

Já existe a função `ensureAssignedToMe` (linha 330) que faz exatamente o necessário: garante participação + atribui ao usuário atual. Ela só não é chamada no fluxo de reabrir.

## Mudança

Arquivo único: `src/pages/Chat.tsx`. Refatorar `reopenTicket`:

1. Antes do UPDATE, garantir que o usuário é participante (insert em `chat_participants` se não existir) — mesma lógica de `ensureAssignedToMe`.
2. UPDATE incluindo `assigned_to: user.id` junto de `status: 'open'` e `closed_at: null`, e usar `.select('id')` para detectar 0 linhas afetadas.
3. Se 0 linhas → toast de erro real ("Sem permissão para reabrir este chamado") em vez do falso sucesso.
4. Em caso de sucesso, manter `loadConversations()` (a conversa volta para "Meus" porque agora está atribuída ao próprio usuário).

Sem mudanças em RLS, edge functions, banco, ou outros arquivos. Sem mudanças visuais.

## Validação

- Logar como funcionário, abrir um chamado fechado pela aba "Fechados", clicar **Reabrir Chamado**:
  - Conversa deve aparecer na aba "Meus" com status aberto.
  - Input de mensagem deve ficar habilitado (`isClosed` vira `false`).
- Repetir como admin — fluxo continua funcionando igual.
- Se um funcionário sem permissão tentar reabrir (cenário improvável, mas possível), deve ver toast de erro em vez de sucesso falso.
