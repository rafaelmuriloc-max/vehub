

# Corrigir conversas duplicadas no chat WhatsApp

## Problema
Existem 9 números de WhatsApp com conversas duplicadas no banco. A causa raiz são duas:

1. **`whatsapp-send`** busca conversa apenas por `client_id` (não por `whatsapp_phone`). Quando clientes diferentes compartilham o mesmo telefone de contato (ex: mesmo sócio com 5 empresas), cada envio via obrigação cria uma conversa nova.

2. **`whatsapp-webhook`** busca por `whatsapp_phone` com `.limit(1)`, encontra apenas uma das duplicatas e ignora as outras.

O resultado: o mesmo número aparece 2-5 vezes na lista de conversas.

## Solução

### Etapa 1 — Unificar busca no `whatsapp-send` (priorizar `whatsapp_phone`)
No `supabase/functions/whatsapp-send/index.ts`, antes de buscar por `client_id`, buscar primeiro por `whatsapp_phone`. Se encontrar, usar essa conversa (e atualizar o `client_id` se necessário). Só criar nova conversa se nenhuma existir por telefone nem por `client_id`.

### Etapa 2 — Unificar busca no `whatsapp-webhook` 
No `supabase/functions/whatsapp-webhook/index.ts`, quando a busca por `whatsapp_phone` retorna múltiplas conversas, usar a mais recente (ou a que tem `status='open'`) em vez de pegar qualquer uma. Isso evita que mensagens sejam inseridas em conversas fechadas quando há uma aberta.

### Etapa 3 — Consolidar duplicatas existentes no banco
Criar e executar uma migração SQL que:
- Para cada `whatsapp_phone` com múltiplas conversas, elege a conversa mais antiga (ou com mais mensagens) como "principal"
- Move todas as `chat_messages` das duplicatas para a conversa principal
- Move `chat_participants` (sem duplicar)
- Remove as conversas duplicatas

## Detalhes técnicos

### `whatsapp-send/index.ts` (~15 linhas alteradas)
Inserir busca por `whatsapp_phone` antes da busca por `client_id`:
```typescript
// 1. Try by whatsapp_phone first
const { data: convByPhone } = await supabaseService
  .from("chat_conversations")
  .select("id, client_id")
  .eq("whatsapp_phone", cleanPhone)
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (convByPhone) {
  conversationId = convByPhone.id;
} else {
  // 2. Fallback: by client_id (existing logic)
}
```

### `whatsapp-webhook/index.ts` (~3 linhas alteradas)
Alterar a query de busca por `whatsapp_phone` para ordenar por `updated_at desc` e preferir conversas abertas:
```typescript
const { data: convByPhone } = await supabase
  .from("chat_conversations")
  .select("id, client_id, status")
  .eq("whatsapp_phone", phoneRaw)
  .order("status", { ascending: true })  // 'open' before 'closed'
  .order("updated_at", { ascending: false })
  .limit(1);
```

### Migração SQL para consolidar duplicatas existentes
Script que para cada grupo de duplicatas por `whatsapp_phone`:
- Mantém a conversa com mais mensagens
- Move mensagens e participantes das demais para ela
- Deleta as conversas vazias restantes

## Arquivos alterados
- `supabase/functions/whatsapp-send/index.ts` — busca por telefone antes de `client_id`
- `supabase/functions/whatsapp-webhook/index.ts` — ordenação na busca de duplicatas
- Nova migração SQL — consolidação de conversas duplicadas

