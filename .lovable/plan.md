## Problema

A aba **Espera** (filtro `status='open' AND assigned_to IS NULL`) não mostra a conversa do Rafael porque ela está com `status='closed'`. Quando o cliente envia nova mensagem, o webhook só atualiza o `updated_at` — não reabre a conversa.

Confirmado no banco: `chat_conversations` "Rafael Murilo" → `status='closed'`, `assigned_to=NULL`.

## Solução

No `supabase/functions/whatsapp-webhook/index.ts`, ao processar mensagem **incoming** (`!isFromMe`), reabrir a conversa se ela estiver fechada:

- Quando inserir a mensagem, se `!isFromMe`, atualizar `chat_conversations` com `status='open'` e `closed_at=null` (mantendo `assigned_to` como está, ou seja, continua `null` para casos como o Rafael — então cai naturalmente em "Espera").
- Mensagens `fromMe` (eco do nosso painel) NÃO devem reabrir, para não tirar conversas que o atendente acabou de fechar.

### Alteração pontual

Substituir no final do webhook:

```ts
await supabase
  .from("chat_conversations")
  .update({ updated_at: new Date().toISOString() })
  .eq("id", conversationId);
```

por:

```ts
const convUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
if (!isFromMe) {
  convUpdate.status = "open";
  convUpdate.closed_at = null;
}
await supabase.from("chat_conversations").update(convUpdate).eq("id", conversationId);
```

## Resultado esperado

- Cliente envia mensagem → conversa reabre automaticamente.
- Como `assigned_to` continua `null`, ela aparece imediatamente na aba **Espera**.
- Se já estivesse atribuída a alguém, voltaria para a aba "Chat" daquele atendente.