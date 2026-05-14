## Diagnóstico

- A conversa da Géssica está com `waiting_since = 2026-05-14 03:40:30+00`, por isso o badge mostra cerca de 15h.
- As últimas mensagens recebidas do cliente foram hoje às `15:56` (horário de São Paulo / `18:56 UTC`).
- O banco não tem trigger ativo em `chat_messages`; por isso o `waiting_since` não é atualizado quando novas mensagens chegam.
- Todas as datas no banco são `timestamptz` (instantes absolutos). O cálculo do tempo já é correto independente de fuso, mas qualquer formatação ou comparação por "dia" deve usar `America/Sao_Paulo`.

## Plano de correção

1. Migration no Supabase para restaurar o trigger em `chat_messages` e atualizar a função `trg_chat_msg_start_waiting()`, fazendo com que toda nova mensagem recebida (não enviada por nós) reinicie `waiting_since` para o horário daquela mensagem, quando a conversa estiver aberta e sem responsável.
2. Recalcular `waiting_since` das conversas abertas e não atribuídas com base na última mensagem recebida do cliente.
3. Garantir que toda exibição de horário/data relacionada ao tempo de espera (badge, aviso, logs do alerta) use o fuso `America/Sao_Paulo`.
4. Preservar o comportamento atual de zerar/acumular `total_wait_seconds` quando a conversa for atribuída a alguém.

## Detalhes técnicos

Migration:

```sql
CREATE OR REPLACE FUNCTION public.trg_chat_msg_start_waiting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.message_type IN ('text','whatsapp_outgoing') THEN
    RETURN NEW;
  END IF;

  UPDATE public.chat_conversations
     SET waiting_since = NEW.created_at,
         updated_at = GREATEST(updated_at, NEW.created_at)
   WHERE id = NEW.conversation_id
     AND status = 'open'
     AND assigned_to IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_msg_start_waiting ON public.chat_messages;
CREATE TRIGGER chat_msg_start_waiting
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_chat_msg_start_waiting();

-- Recalcular conversas em espera com base na última mensagem do cliente
UPDATE public.chat_conversations c
SET waiting_since = latest.last_incoming_at
FROM (
  SELECT conversation_id, max(created_at) AS last_incoming_at
  FROM public.chat_messages
  WHERE message_type NOT IN ('text','whatsapp_outgoing')
    AND deleted_at IS NULL
  GROUP BY conversation_id
) latest
WHERE c.id = latest.conversation_id
  AND c.status = 'open'
  AND c.assigned_to IS NULL
  AND c.waiting_since IS DISTINCT FROM latest.last_incoming_at;
```

Frontend: o `WaitingBadge` continua usando diferença de timestamps absolutos (correto em qualquer fuso). Para qualquer formatação textual de horário relacionada à espera, usar `America/Sao_Paulo` (`formatInTimeZone` do `date-fns-tz`).

## Resultado esperado

- A conversa da Géssica passará a contar o tempo desde a mensagem das 15:56 (horário de São Paulo).
- Novas mensagens recebidas reiniciam o cronômetro automaticamente.
- Qualquer rótulo de horário aparece sempre no fuso de São Paulo.