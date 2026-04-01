

# Otimizar carregamento do chat

## Problema
A função `loadConversations` executa um loop `for...of` sequencial onde cada conversa faz 3-5 queries separadas ao Supabase (última mensagem, contagem de não lidas, nome do participante, empresas vinculadas). Com N conversas, isso gera dezenas de queries sequenciais, causando lentidão.

## Solução
Paralelizar as queries e reduzir o número total de chamadas ao banco.

## Alterações em `src/pages/Chat.tsx`

### 1. Paralelizar o processamento de conversas
Substituir o `for...of` sequencial por `Promise.all` com `map`, processando todas as conversas em paralelo.

### 2. Batch queries onde possível
- Buscar **todas as últimas mensagens** de uma vez usando uma única query com `in('conversation_id', convIds)` e agrupamento client-side
- Buscar **todas as contagens de não lidas** em paralelo via `Promise.all`
- Buscar **todos os clientes vinculados** em uma única query com `in('id', allClientIds)`
- Buscar **todos os participantes** de conversas 1:1 em uma única query

### 3. Adicionar estado de loading
Mostrar skeleton/spinner enquanto as conversas carregam, para feedback imediato ao usuário.

### 4. Estrutura otimizada

```text
Antes (sequencial):
  Conv1: lastMsg → unread → client → contacts → companies
  Conv2: lastMsg → unread → client → contacts → companies
  Conv3: lastMsg → unread → client → contacts → companies
  Total: ~15 queries sequenciais

Depois (paralelo + batch):
  1. Todas as conversas (já existe)
  2. Em paralelo:
     - Todos os clientes vinculados (1 query)
     - Todos os participantes 1:1 (1 query)
     - Todos os profiles (1 query)
  3. Promise.all para cada conversa:
     - lastMsg + unreadCount + companyLookup (em paralelo por conversa)
  Total: ~3 queries batch + N×3 queries em paralelo (não sequenciais)
```

## Arquivos
- `src/pages/Chat.tsx` -- otimizar `loadConversations`
- `src/components/chat/ConversationList.tsx` -- adicionar prop `loading` com skeletons

