## Diagnóstico

`Chat.tsx > loadConversations` faz, a cada abertura/troca de aba:

- 1 query em `chat_conversations` (182 linhas hoje).
- 1 query em `chat_messages` trazendo **todas as mensagens de todas as conversas** (`.in('conversation_id', convIds).order('created_at')`) só para extrair a última mensagem e contar não-lidas. Hoje são **7.653 linhas** (5.273 dos últimos 30 dias). Isso já está sendo **truncado pelo limite de 1000 linhas** do PostgREST, então conversas antigas estão sem "última mensagem" / contagem errada de não-lidas — além de ser lento.
- 1 query em `clients`, 1 em `chat_participants`, 1 em `client_department_contacts` (sem filtro), depois mais 1 em `profiles` e 1 em `clients` (segunda vez). Total: ~7 round-trips serializados em parte.

E `MessageArea` carrega **todas** as mensagens da conversa ativa, sem limite.

## Correção

1. **Criar função SQL `get_chat_inbox(p_user uuid, p_tab text)`** (SECURITY DEFINER) que retorna em um único round-trip:
   - dados da conversa (id, name, status, assigned_to, whatsapp_phone, client_id, avatar_url, created_at, updated_at);
   - `last_message_content`, `last_message_at` (via LATERAL JOIN com `chat_messages` ORDER BY created_at DESC LIMIT 1);
   - `unread_count` (COUNT FILTER WHERE `message_type NOT IN ('text','whatsapp_outgoing') AND read_at IS NULL`);
   - `assigned_to_name` (LEFT JOIN profiles);
   - filtros por aba (`mine`, `in_progress`, `all`) feitos no SQL.
   - Permissão: `GRANT EXECUTE ... TO authenticated` e respeitar a mesma lógica das RLS (admins veem tudo, etc.).

2. **Refatorar `loadConversations`** para chamar a RPC e em paralelo apenas:
   - `clients` para os `client_id` retornados;
   - `chat_participants` apenas das conversas 1-a-1 sem client_id;
   - `client_department_contacts` filtrado pelos telefones das conversas WhatsApp (em vez de baixar tudo).

3. **Limitar carregamento de mensagens da conversa ativa** em `Chat.tsx` (linha 203–223):
   - Buscar apenas as últimas 100 mensagens (`order created_at desc, limit 100`) e exibir em ordem cronológica (reverse no client).
   - Já basta para o caso atual; paginação de scroll fica para depois se necessário.

4. **Manter o realtime** existente (não muda).

## Validação

- Tempo de carregar `/chat` deve cair de vários segundos para sub-segundo.
- Conversas antigas voltam a mostrar a última mensagem (não estão mais truncadas).
- Contagem de não-lidas correta para todas as 182 conversas.

## Detalhes técnicos

- A função SQL será criada via migration. Exemplo de retorno:
  ```sql
  CREATE OR REPLACE FUNCTION public.get_chat_inbox(p_user uuid, p_tab text)
  RETURNS TABLE (id uuid, name text, status text, assigned_to uuid,
                 whatsapp_phone text, client_id uuid, avatar_url text,
                 is_group boolean, created_at timestamptz, updated_at timestamptz,
                 last_message text, last_message_at timestamptz,
                 unread_count int, assigned_to_name text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT c.id, c.name, c.status, c.assigned_to, c.whatsapp_phone, c.client_id,
           c.avatar_url, c.is_group, c.created_at, c.updated_at,
           lm.content, lm.created_at,
           COALESCE(uc.cnt, 0)::int,
           p.full_name
    FROM chat_conversations c
    LEFT JOIN LATERAL (
      SELECT content, created_at FROM chat_messages
      WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS cnt FROM chat_messages
      WHERE conversation_id = c.id
        AND message_type NOT IN ('text','whatsapp_outgoing')
        AND read_at IS NULL
    ) uc ON true
    LEFT JOIN profiles p ON p.user_id = c.assigned_to
    WHERE
      CASE p_tab
        WHEN 'mine' THEN c.assigned_to = p_user AND c.status = 'open'
        WHEN 'in_progress' THEN c.status = 'open' AND (c.assigned_to <> p_user OR c.assigned_to IS NULL)
        ELSE true
      END
    ORDER BY COALESCE(lm.created_at, c.updated_at) DESC;
  $$;
  ```
- Adicionar índice se ainda não existir: `CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON chat_messages (conversation_id, created_at DESC);` para acelerar o LATERAL.
- Sem mudanças em RLS: a função é SECURITY DEFINER e só lê dados que o usuário autenticado já pode ver via RLS atual (qualquer authenticated vê tudo em `chat_*`).

Sem mudanças no webhook, no envio de mensagens, ou no schema fora do índice + função.
