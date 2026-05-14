## Diagnóstico

O sintoma "tela do chat piscando" + "Transferir/Reabrir não funcionam" tem uma causa única: **um loop de re-render** em `src/pages/Chat.tsx` que recarrega mensagens e conversas continuamente, derrubando os cliques antes de serem registrados.

O loop é:

```text
useEffect "Load messages"  (deps: activeConvId, user, conversations)
   └─ chama loadMessages()
        └─ se há não-lidas, chama loadConversations()
             └─ setConversations(...) muda a referência
                  └─ dispara o mesmo useEffect novamente → reinicia
```

Soma-se a isso a subscription realtime (`chat-messages-realtime`) que chama `loadConversations()` a cada INSERT, e o canal `chat-conversations-counters` que chama `loadConversations()` a cada UPDATE em `chat_conversations`. Em Windows/Chrome (latência de WebSocket Realtime é ligeiramente maior e o profile do v8 difere), o intervalo entre re-renders fica curto o bastante para o React desmontar/remontar `MessageArea` antes do `onClick` dos botões disparar — o usuário vê "piscando" e cliques aparentemente sem efeito.

Outros agravantes detectados:
- `setActiveConvName(conv?.name)` está dentro do mesmo effect de carregar mensagens — qualquer mudança em `conversations` (vinda do realtime) re-roda **tudo**, inclusive um novo `SELECT` de 100 mensagens.
- `loadMessages` faz UPDATE de `read_at` mesmo quando `unreadIds.length === 0` está OK, mas quando há mensagens novas chegando via realtime, cada INSERT marca read e chama `loadConversations()` outra vez → reforça o loop.
- A query de mensagens não depende de `conversations`, então não há motivo para esse array estar nas deps.

## Mudanças

Arquivo único: `src/pages/Chat.tsx`.

1. **Quebrar o effect de mensagens em dois**:
   - Effect A (`[activeConvId, user]`): apenas carrega mensagens da conversa ativa.
   - Effect B (`[activeConvId, conversations]`): apenas atualiza `activeConvName` a partir da lista atual.
   
   Isso elimina a recarga completa de mensagens quando a lista lateral muda.

2. **Remover a chamada `loadConversations()` de dentro de `loadMessages`** após marcar não-lidas. O badge de não-lidas será atualizado pelo canal realtime de `chat_conversations` que já existe (e pelo próprio UPDATE em `chat_messages` que dispara recálculo no servidor — caso necessário, fazer um único `loadConversations()` debounced).

3. **Tirar `loadConversations` das deps da subscription realtime de mensagens** usando uma `ref` para a função (`loadConversationsRef.current()`), para que a subscription não seja recriada a cada render.

4. **Debouncing leve (250 ms) em `loadConversations`** disparado por realtime, para evitar rajadas de refresh quando muitas mensagens entram em sequência.

5. **Garantir estabilidade dos handlers** `reopenTicket` / `openTransferDialog` envolvendo-os em `useCallback` — não muda comportamento, mas evita que `MessageArea` receba props novas a cada render durante o loop residual.

Sem alterações em banco, edge functions, RLS, ou outros arquivos. Sem mudanças visuais.

## Validação

Após aplicar:
- Abrir `/chat`, abrir uma conversa com WhatsApp ativa, observar console — não deve haver chamadas repetidas para `get_chat_inbox` enquanto a conversa estiver aberta e ociosa.
- Clicar em **Transferir** e em **Reabrir Chamado** — devem abrir o diálogo / executar a ação na primeira tentativa.
- Enviar 3 mensagens rápidas via outro cliente — a lista lateral deve atualizar sem "piscar" o painel direito.
