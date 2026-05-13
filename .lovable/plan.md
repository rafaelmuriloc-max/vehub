## Diagnóstico

- ✅ Subscription do iPhone gravada em `user_push_subscriptions` (1 registro, Safari iOS 18).
- ✅ Trigger `chat_messages_notify` existe e está ativo na tabela `chat_messages`.
- ✅ Extensão `pg_net` instalada.
- ❌ A função `trg_notify_chat_message` chama `extensions.http_post(...)`, mas no projeto a função do pg_net está no schema **`net`** (`net.http_post`). A chamada lança erro, que é silenciosamente engolido pelo `EXCEPTION WHEN OTHERS`. Resultado: a edge function `chat-notify` **nunca é invocada** (0 logs).

## Correção (1 migração SQL)

Recriar `public.trg_notify_chat_message` trocando `extensions.http_post` por `net.http_post` e ajustando o `search_path`:

```sql
CREATE OR REPLACE FUNCTION public.trg_notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
AS $$
DECLARE
  fn_url text := 'https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/chat-notify';
  anon_key text := '<anon key atual>';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || anon_key
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
```

Observação: vou **remover o `EXCEPTION WHEN OTHERS`** para que erros futuros apareçam nos logs do Postgres (ou mantê-lo logando via `RAISE LOG` — me diga a preferência; padrão sugerido: remover, já que `net.http_post` é assíncrono e não bloqueia o INSERT).

## Validação

1. Após aplicar, enviar uma mensagem de teste no chat.
2. Verificar logs da função `chat-notify` (deve aparecer a invocação).
3. Confirmar notificação chegando no iPhone instalado (PWA aberto via "Adicionar à Tela de Início").

## Caso ainda não chegue após a correção

- Conferir se Safari/iOS realmente concedeu permissão (banner sumiu = `permission === 'granted'`).
- Conferir tabela `net._http_response` para resposta da chamada do trigger.
- Inspecionar logs do `chat-notify` para erros do `web-push` (ex.: VAPID inválido).
