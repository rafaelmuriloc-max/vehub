
## Diagnóstico

O erro `400 "Error: Connection Closed"` da Evolution API só acontece para alguns contatos porque o número enviado não corresponde ao JID realmente registrado no WhatsApp daquele contato.

No Brasil, números antigos (especialmente DDDs do Sul/Sudeste cadastrados antes de 2012) não têm o nono dígito no WhatsApp, mesmo que o telefone seja salvo com o 9. Quando o sistema envia `5547997057925@s.whatsapp.net` e o JID real é `554797057925@s.whatsapp.net`, a Baileys (engine da Evolution) abre o socket, não encontra o destinatário e devolve "Connection Closed".

Os contatos que funcionam pela Meta API (dentro da janela de 24h) também funcionariam pela Evolution se o JID correto fosse usado — o Meta normaliza internamente, a Evolution não.

## Solução

Adicionar uma etapa de **resolução de JID** antes de qualquer envio pela Evolution API, usando o próprio endpoint da Evolution `POST /chat/whatsappNumbers/{instance}` que aceita uma lista de números e devolve o JID real (`jid`) e se o número existe (`exists: true`).

### Fluxo novo (Evolution)

```text
1. Normalizar telefone para dígitos com 55 + DDD + (9 opcional) + 8 dígitos
2. Chamar /chat/whatsappNumbers/{instance} com [numeroCanonico, numeroSem9]
3. Para cada resposta exists=true, usar exatamente o "jid" devolvido
4. Se nenhum existir, retornar { ok:false, transient:false, error:"Número não está no WhatsApp" }
5. Enviar via /message/sendText/{instance} usando o number = JID resolvido (sem o sufixo @s.whatsapp.net)
6. Em caso de 500/Connection Closed mesmo após resolução: 1 retry após 1s
```

### Arquivos afetados

1. **`supabase/functions/whatsapp-send-text/index.ts`**
   - Criar helper `resolveWhatsAppJid(phone)` que faz a chamada `/chat/whatsappNumbers`
   - Usar JID resolvido nas duas ramificações que enviam via Evolution (fallback Meta→Evo e envio direto fora da janela 24h)
   - Mensagem de erro amigável quando `exists=false`: "Este número não possui WhatsApp"

2. **`supabase/functions/whatsapp-send-media/index.ts`**
   - Mesmo helper e mesma lógica

3. **`supabase/functions/chat-inactivity-monitor/index.ts`**
   - Resolver JID antes de enviar o aviso de inatividade (atualmente também loga "Connection Closed")

4. **`supabase/functions/daily-cs-reminder/index.ts`**
   - Mesma proteção, para grupos pular a resolução (grupos usam `@g.us`)

5. **`supabase/functions/whatsapp-send/index.ts`** (legado, se usado)
   - Aplicar o mesmo padrão por consistência

### Detalhe técnico do helper

```ts
async function resolveWhatsAppJid(phoneDigits: string): Promise<{ jid: string | null; exists: boolean }> {
  // Gera variantes: com 9 e sem 9 (apenas para celulares BR com 13 dígitos)
  const variants = new Set<string>([phoneDigits]);
  if (phoneDigits.length === 13 && phoneDigits.startsWith('55') && phoneDigits[4] === '9') {
    variants.add(phoneDigits.slice(0, 4) + phoneDigits.slice(5)); // sem o 9
  } else if (phoneDigits.length === 12 && phoneDigits.startsWith('55')) {
    variants.add(phoneDigits.slice(0, 4) + '9' + phoneDigits.slice(4)); // com o 9
  }

  const r = await fetch(`${EVO_URL}/chat/whatsappNumbers/${INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ numbers: [...variants] }),
  });
  if (!r.ok) return { jid: null, exists: false };
  const arr = await r.json(); // [{ exists, jid, number }]
  const hit = (arr || []).find((x: any) => x?.exists);
  return { jid: hit?.jid ?? null, exists: !!hit };
}
```

O `number` passado ao `/message/sendText` passa a ser `jid.replace('@s.whatsapp.net','')` — assim o quoted reply continua usando o `remoteJid` correto.

### Tratamento de erro no frontend

`Chat.tsx` já trata `{ ok:false, transient }`. Não precisa mudar a UI; apenas a mensagem de toast vai ficar mais clara quando `transient=false` e o erro for "número não possui WhatsApp".

## Fora do escopo

- Persistir o JID resolvido em cache (otimização futura)
- Atualizar `chat_conversations.whatsapp_phone` com o número canonizado pela Evolution
- Mudanças no fluxo Meta API (já funciona)

## Validação

1. Enviar mensagem para um contato que estava falhando → verificar log "Resolved JID: 554..." e sucesso
2. Enviar para um número fake (ex: 5511999999999) → toast "Este número não possui WhatsApp"
3. Enviar para contato que já funcionava → continua funcionando
