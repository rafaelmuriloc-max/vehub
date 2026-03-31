

# Corrigir conversas duplicadas e foto de perfil

## Problema raiz

### Conversas duplicadas
O webhook busca conversas existentes por `client_id` ou pelo número de telefone no `name` da conversa (`ilike("name", "%554791004860%")`). Depois que o nome foi atualizado para "Rafael Murilo", o número de telefone não está mais no nome, então a busca falha e uma nova conversa é criada a cada mensagem.

### Foto não aparece
A foto está sendo salva corretamente no banco (confirmado nos logs e network requests). O problema é que conversas duplicadas são criadas sem a foto (a foto só é buscada na criação da primeira conversa, mas como cria uma nova a cada vez, algumas ficam sem).

## Solução

Adicionar uma coluna `whatsapp_phone` na tabela `chat_conversations` para armazenar o número de telefone do WhatsApp. Isso permite buscar a conversa existente de forma confiável, independente do nome.

## Alterações

### 1. Migração SQL
- Adicionar coluna `whatsapp_phone text` em `chat_conversations`
- Backfill: extrair números das conversas existentes que têm nome com formato de telefone ou foram criadas pelo webhook
- Criar índice para busca rápida

### 2. `supabase/functions/whatsapp-webhook/index.ts`
- Ao buscar conversa existente, usar `whatsapp_phone` como critério principal (antes de `client_id` ou nome)
- Ao criar conversa, salvar o `phoneRaw` na coluna `whatsapp_phone`
- Ordem de busca: `whatsapp_phone` -> `client_id` -> fallback por nome

### 3. `supabase/functions/whatsapp-send/index.ts`
- Ao criar conversa de envio, também salvar o telefone em `whatsapp_phone`

## Arquivos modificados
- Migração SQL -- coluna `whatsapp_phone` + backfill
- `supabase/functions/whatsapp-webhook/index.ts` -- buscar/salvar por `whatsapp_phone`
- `supabase/functions/whatsapp-send/index.ts` -- salvar `whatsapp_phone`

