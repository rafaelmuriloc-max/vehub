

# Corrigir nome da conversa WhatsApp na lista e cabeçalho

## Problema raiz
Quando a conversa foi criada sem um `client_id` (cliente não encontrado no momento), o nome ficou como "WhatsApp 554791004860". Em mensagens futuras, mesmo que o cliente seja encontrado pelo telefone, o webhook não consegue vincular a conversa existente porque busca por `client_id` (que é null na conversa antiga). Isso resulta em conversas duplicadas ou nome nunca atualizado.

## Alterações

### 1. `supabase/functions/whatsapp-webhook/index.ts`
Quando o cliente é encontrado pelo telefone mas não existe conversa com esse `client_id`, **buscar também por nome contendo o número** antes de criar uma nova conversa. Se encontrar, atualizar o `client_id` e o `name` da conversa existente:

```typescript
if (clientId) {
  // Busca por client_id
  const { data: existingConv } = await supabase...eq("client_id", clientId);
  
  if (!existingConv?.length) {
    // Fallback: busca por número no nome (conversa criada antes do vínculo)
    const { data: convByPhone } = await supabase...ilike("name", `%${phoneRaw}%`);
    if (convByPhone?.length) {
      conversationId = convByPhone[0].id;
      // Atualizar client_id e nome
      await supabase.update({ client_id: clientId, name: `${clientName} (WhatsApp)` });
    }
  }
}
```

### 2. Migração SQL — corrigir conversas existentes
Atualizar conversas que têm nome no formato "WhatsApp {número}" vinculando ao cliente correto pelo telefone:

```sql
UPDATE chat_conversations cc
SET client_id = c.id,
    name = COALESCE(c.contact_name, c.company_name) || ' (WhatsApp)'
FROM clients c
WHERE cc.client_id IS NULL
  AND cc.name ~ '^WhatsApp \d+'
  AND c.contact_phone IS NOT NULL
  AND REPLACE(REPLACE(REPLACE(c.contact_phone, '(', ''), ')', ''), '-', '') 
      LIKE '%' || RIGHT(REGEXP_REPLACE(SUBSTRING(cc.name FROM '\d+'), '\D', '', 'g'), 9) || '%';
```

### 3. `src/pages/Chat.tsx` — nenhuma alteração
O código já resolve o nome via `client_id` (linhas 66-74). Uma vez que o `client_id` esteja vinculado na conversa, o nome aparecerá corretamente.

## Arquivos modificados
- `supabase/functions/whatsapp-webhook/index.ts` — buscar conversa por telefone no nome quando client_id não encontra
- Migração SQL — vincular `client_id` e atualizar nome das conversas existentes

