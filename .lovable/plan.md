## Diagnóstico

Logs do edge function `whatsapp-send-text` mostram que mensagens recentes (18:45) ainda foram gravadas com `sender_id` do Márcio. Como o código atual já lê `senderId` do body e cai no admin como fallback, isso significa que o body chegou **sem** `senderId` — ou seja, o navegador do Bruno ainda está usando o frontend antigo (cache do PWA / service worker), antes do fix `senderId: user.id` em `src/pages/Chat.tsx`.

Há duas frentes para resolver de forma definitiva, sem depender do cache do navegador:

## Correção

1. **Derivar `senderId` do JWT da requisição na edge function** (fonte da verdade do servidor):
   - Em `whatsapp-send-text/index.ts` e `whatsapp-send-media/index.ts`, ler o header `Authorization`, extrair o token e chamar `supabase.auth.getUser(token)` para obter o `auth.uid()` real do chamador.
   - Usar essa ordem de prioridade: `senderId` extraído do JWT → `senderIdInput` do body → primeiro admin.
   - Logar o `senderId` final escolhido para facilitar futura depuração.

2. **Forçar invalidação de cache no Bruno** (após item 1, o problema some mesmo com cache, mas vale garantir):
   - Atualizar a versão do `public/sw.js` (bump de cache name) para invalidar o service worker e forçar o navegador do Bruno a baixar o frontend novo.

## Validação

- Após deploy: pedir ao Bruno para enviar uma mensagem nova; verificar nos logs do edge function que `senderId` extraído do JWT corresponde ao id do Bruno (`5cddbc26-…`).
- Conferir no banco: a próxima mensagem `whatsapp_outgoing` deve ter `sender_id = 5cddbc26-…` e aparecer assinada como "Bruno Reinert".
- Mensagens antigas continuam históricas com Márcio (não retroativas).

## Detalhes técnicos

- O JWT do usuário chega no header `Authorization: Bearer <token>` toda vez que o frontend chama `supabase.functions.invoke(...)` (com a sessão ativa).
- `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` permite chamar `supabase.auth.getUser(jwt)` para validar e obter `data.user.id` sem precisar de `verify_jwt`.
- Não muda schema, RLS, nem comportamento do webhook de entrada.
