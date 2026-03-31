

# Remover "(WhatsApp)" do nome das conversas

## Alterações

### 1. `supabase/functions/whatsapp-webhook/index.ts`
- Remover o sufixo ` (WhatsApp)` de todas as ocorrências onde o nome da conversa é definido ou atualizado
- Usar apenas `clientName` ou `pushName` sem sufixo

### 2. `supabase/functions/whatsapp-send/index.ts`
- Mesmo ajuste: remover ` (WhatsApp)` ao criar ou atualizar nome de conversa

### 3. Migração SQL
- Atualizar conversas existentes removendo o sufixo:
```sql
UPDATE chat_conversations
SET name = REPLACE(name, ' (WhatsApp)', '')
WHERE name LIKE '% (WhatsApp)';
```

## Arquivos modificados
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/whatsapp-send/index.ts`
- Nova migração SQL

