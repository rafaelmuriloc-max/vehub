# Backfill: renderizar mensagens de template enviadas hoje

## Objetivo

Reescrever o `content` das `chat_messages` criadas hoje que ficaram como `[Template: nome_do_template]`, substituindo pelo corpo renderizado do template (mesmas variáveis que o novo fluxo já produz).

## Fonte dos dados

- `whatsapp_logs` (de hoje): tem `template_name`, `template_params` (JSON com `parameter_name`+`text`), `instance_id`, `client_id`, `sent_at`.
- `obligation_activities`: tem `whatsapp_message_body` (template `{{var}}`) por `whatsapp_template_name`.
- `chat_messages`: `content` começa com `[Template: <nome>]`, ligado por `conversation_id` (que liga ao `client_id` via `chat_conversations`).

## Como reconstruir cada mensagem

1. Para cada `whatsapp_logs` de hoje com `template_name` não nulo:
   - Buscar `obligation_activities.whatsapp_message_body` onde `whatsapp_template_name = log.template_name` (qualquer atividade serve — o corpo é o mesmo do template aprovado).
   - Construir mapa `{{var}} -> text` a partir de `template_params` (procurando o componente `type='body'` e iterando `parameters[].parameter_name/text`).
   - Renderizar `body.replace(/\{\{(\w+)\}\}/g, (_, n) => map[n] ?? '')`.
2. Localizar a `chat_messages` correspondente:
   - `conversation_id` via `chat_conversations.client_id = log.client_id` (se múltiplas, a mais recente).
   - `content = '[Template: ' || log.template_name || ']'`.
   - `created_at` entre `log.sent_at - 30s` e `log.sent_at + 30s`.
   - Pegar a mais próxima por timestamp.
3. Atualizar `chat_messages.content` para o texto renderizado.

## Execução

Criar um script único via `psql` (migration) usando CTE/UPDATE em SQL puro — evita edge function. O `whatsapp_message_body` permite `regexp_replace` iterativo via `jsonb_array_elements`.

## Escopo

- Apenas mensagens de **hoje** (`created_at >= CURRENT_DATE`).
- Apenas as que começam com `[Template: ` (não toca em mensagens normais).
- Templates sem `whatsapp_message_body` cadastrado em alguma `obligation_activities` permanecem como estão (não há como reconstruir o corpo).

## Detalhe técnico do SQL

```sql
WITH src AS (
  SELECT 
    wl.id AS log_id, wl.client_id, wl.template_name, wl.sent_at,
    wl.template_params,
    (SELECT oa.whatsapp_message_body 
       FROM obligation_activities oa
      WHERE oa.whatsapp_template_name = wl.template_name
        AND oa.whatsapp_message_body IS NOT NULL
      LIMIT 1) AS body_template
  FROM whatsapp_logs wl
  WHERE wl.sent_at >= CURRENT_DATE
    AND wl.template_name IS NOT NULL
),
rendered AS (
  SELECT s.*,
    (SELECT string_agg_render(...))  -- itera params e dá replace
  FROM src s
  WHERE s.body_template IS NOT NULL
)
UPDATE chat_messages cm
SET content = r.rendered_body
FROM rendered r
JOIN chat_conversations cc ON cc.client_id = r.client_id
WHERE cm.conversation_id = cc.id
  AND cm.content = '[Template: ' || r.template_name || ']'
  AND cm.created_at BETWEEN r.sent_at - interval '30 seconds' 
                        AND r.sent_at + interval '30 seconds';
```

A renderização (`replace` iterativo dos `{{var}}`) será feita por uma função PL/pgSQL temporária no migration que recebe `(body text, params jsonb)` e devolve o texto final.

## Fora de escopo

- Mensagens anteriores a hoje.
- Mensagens cujo template não foi mapeado em alguma `obligation_activities`.
- Reenvio para o WhatsApp (já foram entregues — só corrigimos a exibição interna no chat).
