## Problema

Mensagens enviadas usam a Meta API e salvam `wa_message_id` no formato `wamid.HBgM...`. Mensagens recebidas chegam pela Evolution API e salvam o id cru do WhatsApp (`3EB0...`, `2A79...`). Os dois formatos não conversam entre si:

- Resposta nossa → cliente: enviamos pela Meta com `context.message_id = <id da Evolution>`, a Meta ignora e o cliente recebe sem citação.
- Resposta do cliente → nós: webhook recebe `stanzaId` no formato cru, mas nosso outgoing está salvo com prefixo `wamid.`. O lookup `wa_message_id = stanzaId` falha, `reply_to_id` fica NULL e nada é renderizado.

## Solução

Manter os dois formatos lado a lado em uma nova coluna e usar a API correta para cada caso de resposta.

### 1. Banco

Adicionar coluna `wa_evolution_id text` em `chat_messages` (id no formato Evolution / WhatsApp cru, sem prefixo `wamid.`). Índice em `(conversation_id, wa_evolution_id)`.

Backfill: para linhas existentes onde `wa_message_id` não começa com `wamid.`, copiar o valor para `wa_evolution_id`.

### 2. Webhook (`whatsapp-webhook`)

- Para qualquer mensagem (incoming ou outgoing eco do vhub), gravar `wa_evolution_id = key.id`.
- No backfill do bloco `vhub_origin` (mensagem nossa ecoando da Evolution), em vez de sobrescrever `wa_message_id`, gravar apenas `wa_evolution_id = key.id` — preservando o `wamid.` original da Meta.
- Lookup de resposta entrante: buscar a mensagem original por `wa_evolution_id = quotedStanzaId` (não mais por `wa_message_id`). Isso resolve o caso "cliente responde uma mensagem nossa".

### 3. Envio (`whatsapp-send-text` e `whatsapp-send-media`)

Ao receber `replyToMessageId`, buscar `wa_message_id`, `wa_evolution_id` e `message_type` da mensagem original e decidir o canal:

```text
Tipo da original         | API usada para enviar a resposta
-------------------------+----------------------------------
outgoing (wamid.* válido)| Meta API com context.message_id = wa_message_id
incoming (id Evolution)  | Evolution API com quoted.key.id = wa_evolution_id
```

Quando a janela de 24h está fechada, já caímos em Evolution — usar `wa_evolution_id` da original.

Se a Meta retornar erro de `context` inválido, fazer fallback automático para Evolution com `quoted.key.id`.

Salvar a nova mensagem outgoing com:
- `wa_message_id` = wamid retornado pela Meta (quando enviado pela Meta)
- `wa_evolution_id` = key.id retornado pela Evolution (quando enviado pela Evolution; a Meta não devolve isso, então fica para o eco do webhook preencher)

### 4. Frontend

Sem mudanças funcionais — `reply_to_snapshot` continua sendo renderizado pelo `MessageBubble`. Apenas garantir que o `Chat.tsx` carregue `wa_evolution_id` no SELECT (não é estritamente necessário para UI, mas mantém o tipo coerente).

## Fora de escopo

- Migrar inteiramente para o webhook da Meta (resolveria de vez, mas exige reconfigurar no Business Manager).
- Tornar replies funcionais para mensagens antigas (anteriores ao deploy) que só têm um dos formatos — só novas mensagens citadas funcionarão dos dois lados; histórico continua sem citação onde já está NULL.
