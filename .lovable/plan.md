## Causa-raiz

A tabela `chat_conversations` tem **7 pares de conversas duplicadas** — mesmo `whatsapp_phone`, dois `id` diferentes (ex.: "Dunga e Juh" e "Marcio" na sua tela). Não há mensagens duplicadas no banco; o que duplica é a **conversa em si**, e cada cópia carrega seu próprio histórico parcial.

Por que aconteceu: o `whatsapp-webhook` faz `SELECT ... WHERE whatsapp_phone IN (variants)` e, se nada encontrar, faz `INSERT`. Quando duas mensagens do mesmo contato chegam quase simultaneamente (corrida típica do Evolution disparando vários eventos), **as duas execuções leem "não existe" ao mesmo tempo e cada uma cria uma conversa**. Não há `UNIQUE` em `whatsapp_phone`, então o banco aceita.

A partir daí, qualquer webhook seguinte cai consistente na "primeira" que o `ORDER BY status, updated_at` retorna — mas a outra cópia permanece visível no UI com mensagens antigas, criando a sensação de duplicidade.

Mensagens em si não duplicam (já confirmado: nenhum `wa_message_id` aparece duas vezes).

## O que vai ser feito

### 1. Migration: mesclar duplicatas existentes
Para cada par de conversas com o mesmo `whatsapp_phone` (atualmente 7):
- Eleger a conversa "principal" (a mais antiga — `created_at` ASC).
- Migrar todas as referências da conversa secundária para a principal:
  - `chat_messages.conversation_id`
  - `chat_participants.conversation_id` (com `ON CONFLICT DO NOTHING` para não violar PK composta)
  - `triage_learnings.conversation_id`
- Atualizar metadados da principal (último `updated_at`, herdar `client_id`/`avatar_url`/`name_locked` se a principal estiver vazia).
- Deletar a conversa secundária.

### 2. UNIQUE INDEX parcial em `whatsapp_phone`
```sql
CREATE UNIQUE INDEX chat_conv_unique_phone
  ON public.chat_conversations (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL AND is_group = false;
```
Grupos continuam podendo ter `whatsapp_phone` nulo/repetido sem restrição (não é o caso hoje, mas mantém flexível).

### 3. Webhook resiliente à corrida
Em `supabase/functions/whatsapp-webhook/index.ts`, no bloco que cria a conversa quando `!conversationId`:
- Após o `INSERT`, se vier `error.code = '23505'` (unique violation), refazer o `SELECT` por `whatsapp_phone` e usar o `id` que o concorrente acabou de criar — em vez de falhar.
- Mantém o restante da lógica intacta (variants, name lock, avatar, etc.).

## Arquivos afetados

```text
supabase/migrations/<ts>_dedupe_chat_conversations.sql   (novo)
  - DO $$ ... $$ que mescla duplicatas existentes
  - CREATE UNIQUE INDEX chat_conv_unique_phone

supabase/functions/whatsapp-webhook/index.ts             (pequeno ajuste)
  - tratamento de 23505 no insert da conversa
```

## O que NÃO muda

- UI do chat (`ConversationList`, `MessageArea`) — depois da mesclagem cada contato vira 1 linha só, sem alteração de componente.
- Lógica de mensagens, realtime, atribuição, status de atendimento.
- Grupos e conversas internas (sem `whatsapp_phone`).

## Resultado

- As 7 conversas duplicadas viram 7 conversas únicas com todo o histórico mesclado.
- Novas mensagens em corrida do mesmo número nunca mais conseguem criar uma segunda linha — o banco impede e o webhook se recupera sozinho usando a conversa que venceu a corrida.
