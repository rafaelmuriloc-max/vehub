## Objetivo

Adicionar contador de tempo de espera nas conversas da aba "Espera" (status `open` e sem `assigned_to`), que:
- Roda em tempo real enquanto a conversa estiver aguardando atribuição
- Para e zera quando a conversa for atribuída a um usuário
- Persiste o tempo total de espera para uso futuro em estatísticas

## Mudanças no banco

Adicionar duas colunas em `chat_conversations`:
- `waiting_since` (timestamptz) — momento em que a conversa entrou em espera (recebeu mensagem do cliente sem responsável). Fica `NULL` quando atribuída.
- `total_wait_seconds` (integer, default 0) — soma acumulada do tempo aguardando atribuição em todas as ocorrências (suporta estatísticas mesmo se a conversa voltar para fila).

Atualizar `get_chat_inbox` para retornar `waiting_since` e `total_wait_seconds`.

Criar trigger em `chat_conversations` (BEFORE UPDATE):
- Quando `assigned_to` muda de NULL para um valor: somar `now() - waiting_since` em `total_wait_seconds` e zerar `waiting_since`.
- Quando `assigned_to` muda de valor para NULL (devolução à fila): setar `waiting_since = now()`.

Criar trigger em `chat_messages` (AFTER INSERT):
- Quando chega mensagem de entrada (cliente) e a conversa está `open` sem `assigned_to` e sem `waiting_since`: setar `waiting_since = NEW.created_at`.

Backfill: para conversas atualmente `open` sem `assigned_to`, setar `waiting_since = updated_at`.

## Mudanças no frontend

**`ConversationList.tsx`** — quando `activeTab === 'in_progress'`:
- Mostrar badge com cronômetro ao lado do horário, formato `mm:ss` até 1h, depois `Hh mm`.
- Tick a cada 1s via `setInterval` em estado local; cor muda conforme o tempo (verde <5min, âmbar 5–15min, vermelho >15min).
- Calcula a partir de `waiting_since`.

**`ConversationItem` interface** — adicionar `waitingSince?: string | null` e `totalWaitSeconds?: number`.

**`Chat.tsx`** — propagar os novos campos do `get_chat_inbox` para o componente.

## Detalhes técnicos

```text
chat_conversations
├── waiting_since        timestamptz NULL
└── total_wait_seconds   integer DEFAULT 0
```

Funções/triggers:
- `trg_chat_conv_assignment()` BEFORE UPDATE em `chat_conversations`
- `trg_chat_msg_waiting()` AFTER INSERT em `chat_messages` (apenas para mensagens vindas do cliente — `message_type IN ('whatsapp_incoming', ...)`, não outgoing)

Critério de "mensagem de cliente": `message_type` diferente de `'text'` e `'whatsapp_outgoing'` (mesma lógica já usada em `unread_count` no `get_chat_inbox`).

Render do contador: hook leve `useTick(1000)` que força re-render, evitando setInterval por item.

## Estatísticas futuras

Com `total_wait_seconds` por conversa, fica trivial calcular tempo médio/máximo de resposta por período, por responsável (após atribuição) etc. — sem mudanças adicionais nesta entrega.
