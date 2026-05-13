## Diagnóstico

A Edge Function `chat-notify` está enviando o payload correto (confirmado nos logs):

```
title: "Cezar · SONHOS DE PENHA LTDA"
body: "Perfeito muito obrigado e dessculpa a hr"
```

Mas o iPhone mostra apenas `Velocità · Notificação`. Isso é o **texto genérico que o iOS exibe quando o Service Worker não consegue exibir o conteúdo do payload**. As causas mais prováveis:

1. **SW antigo cacheado no PWA instalado** — o iPhone instalou o app quando o `sw.js` tinha outra versão (ou estava silencioso). O `SW_VERSION = 'v3'` atual não foi suficiente para forçar atualização em todos os dispositivos.
2. **Parsing do payload falhando silenciosamente** — `event.data.json()` pode lançar exceção em iOS se o conteúdo estiver com encoding diferente. O `try/catch` atual cai num `{}` vazio, e aí `title = 'Nova mensagem'` deveria aparecer — mas se o `showNotification` não for chamado dentro do `event.waitUntil()` corretamente, o iOS substitui por "Notificação".
3. **Falta de `event.waitUntil` cobrindo todo o trabalho assíncrono** — qualquer await fora dele faz iOS abortar e mostrar notificação default.

## Mudanças

### 1. `public/sw.js` — Robustecer o handler de push

- Bumpar `SW_VERSION` para `'v4'` para forçar reinstalação em todos os dispositivos.
- Reorganizar o `push` listener para envolver TODO o trabalho assíncrono em `event.waitUntil(async () => {...}())`.
- Garantir parsing defensivo do payload (texto cru → JSON), com `console.log` para debug.
- Sempre passar `body` não-vazio (fallback `'Nova mensagem'`).
- Adicionar `image` opcional e `data.message_id` para futuro deep-link por conversa.

```js
const SW_VERSION = 'v4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (_) {
      try { data = JSON.parse(event.data.text()); } catch (_) {}
    }
    const title = (data.title && String(data.title).trim()) || 'Nova mensagem';
    const body  = (data.body  && String(data.body).trim())  || ' ';
    await self.registration.showNotification(title, {
      body,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      tag: data.tag || 'chat',
      data: { url: data.url || '/chat' },
      renotify: true,
    });
  })());
});
```

### 2. `supabase/functions/chat-notify/index.ts` — Diagnóstico e robustez

- Truncar body para 100 chars (iOS corta mesmo, e payloads grandes podem falhar criptografia).
- Garantir que `title` nunca seja vazio (fallback "Nova mensagem").
- Manter logs já existentes.

### 3. Orientação ao usuário (não é código)

Para o iPhone aplicar o novo SW, o usuário precisa:
- Abrir o PWA instalado uma vez (com internet) → o navegador busca o `sw.js` novo.
- Fechar e abrir de novo para o SW assumir.
- Em casos extremos (iOS é teimoso): remover o app da tela inicial e adicionar de novo via Safari → Compartilhar → Adicionar à Tela de Início.

## Resultado esperado

Próxima mensagem recebida no chat aparece no lock screen do iPhone como:

```
Cezar · SONHOS DE PENHA LTDA
Perfeito muito obrigado...
```

em vez do genérico "Velocità · Notificação".
