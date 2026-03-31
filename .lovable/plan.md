

# Mensagens WhatsApp não aparecem no Chat — Diagnóstico e Correção

## Problema
Analisando os logs e o código, o webhook **está funcionando** — as mensagens são salvas no banco. O problema é de **visibilidade**: o Chat só mostra conversas onde o usuário logado é participante (`chat_participants`). 

O webhook adiciona apenas o **primeiro admin** encontrado como participante. Se o usuário logado não é esse admin específico, ele não vê a conversa nem as mensagens.

Além disso, existem 2 problemas adicionais:
1. O `whatsapp-send` e o `whatsapp-webhook` podem criar conversas separadas para o mesmo cliente (um busca por `client_id`, outro também, mas podem não encontrar a mesma conversa)
2. A RLS de `chat_messages` exige que o `sender_id = auth.uid()` para INSERT — mas o webhook usa `service_role` (bypassa RLS), o que está OK. Porém, a atualização de `read_at` pode falhar se o usuário não for o sender.

## Correções

### 1. `supabase/functions/whatsapp-webhook/index.ts`
Após criar a conversa e adicionar o admin como participante, **adicionar TODOS os admins** como participantes da conversa WhatsApp, para que todos vejam as mensagens:

```typescript
// Get ALL admin users
const { data: adminRoles } = await supabase
  .from("user_roles")
  .select("user_id")
  .eq("role", "admin");

// Add all admins as participants
for (const admin of adminRoles || []) {
  const { data: existing } = await supabase
    .from("chat_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", admin.user_id)
    .maybeSingle();
  
  if (!existing) {
    await supabase.from("chat_participants").insert({
      conversation_id: conversationId,
      user_id: admin.user_id,
    });
  }
}
```

### 2. `supabase/functions/whatsapp-send/index.ts`
Mesmo ajuste: ao criar uma conversa WhatsApp via envio, adicionar todos os admins como participantes (não apenas o remetente).

### 3. Migração SQL — adicionar admins existentes às conversas WhatsApp já criadas
Inserir participantes faltantes nas conversas WhatsApp existentes para que os admins atuais passem a vê-las imediatamente.

```sql
INSERT INTO chat_participants (conversation_id, user_id)
SELECT cc.id, ur.user_id
FROM chat_conversations cc
CROSS JOIN user_roles ur
WHERE ur.role = 'admin'
  AND cc.name ILIKE '%WhatsApp%'
  AND NOT EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.conversation_id = cc.id AND cp.user_id = ur.user_id
  );
```

### 4. RLS — permitir update de `read_at` em mensagens da conversa (não apenas próprias)
A política atual de UPDATE em `chat_messages` exige `sender_id = auth.uid()`. Isso impede que um participante marque como lida uma mensagem recebida. Adicionar política:

```sql
CREATE POLICY "Participants can mark messages as read"
ON public.chat_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
);
```

## Arquivos modificados
- `supabase/functions/whatsapp-webhook/index.ts` — adicionar todos os admins como participantes
- `supabase/functions/whatsapp-send/index.ts` — adicionar todos os admins como participantes
- Migração SQL — backfill participantes + nova RLS policy

