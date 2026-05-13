# Notificações de chat no celular

Combinar **Web Push (PWA)** com fallback **WhatsApp**, disparados sempre que entrar mensagem nova de cliente. Destinatário: usuário **atribuído à conversa** + integrantes do **grupo Velocitä** no WhatsApp.

## 1. PWA instalável + Web Push

**Manifest e Service Worker**
- Criar `public/manifest.webmanifest` (nome "Velocitä", ícones 192/512, theme color navy, `display: standalone`).
- Criar `public/sw.js` mínimo (sem cache de HTML — apenas listener de `push` e `notificationclick`). Não usar `vite-plugin-pwa` para evitar problemas com o preview do Lovable.
- Registrar o SW só fora do iframe/preview (guard padrão Lovable).
- Adicionar `<link rel="manifest">` e meta tags iOS no `index.html`.

**Permissão e subscription**
- Hook `useWebPush` que: pede permissão, registra `PushSubscription` com chave VAPID pública, e salva no Supabase.
- Botão "Ativar notificações no celular" em **Configurações** (e banner sutil no `/chat` mobile na primeira visita).

**Tabela nova**
- `user_push_subscriptions` (id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at). RLS: usuário gerencia só as próprias; service role lê todas.

## 2. Disparo das notificações

**Edge function `chat-notify`** (verify_jwt=false, chamada por trigger):
- Recebe `{ message_id }`.
- Busca a mensagem, conversa, `assigned_to`, e admins (via `user_roles`).
- Determina destinatários: `assigned_to` ∪ `admins` (admins = "grupo Velocitä" interno).
- Para cada destinatário:
  - Busca todas as `user_push_subscriptions` → envia Web Push (Web Push Protocol com VAPID, via lib `npm:web-push`).
  - Remove subscription se receber 404/410.
- Fallback WhatsApp: se o destinatário tiver `whatsapp_phone` no profile **e** nenhuma subscription ativa **ou** estiver offline há > X min, envia template WhatsApp via grupo Velocitä existente (Evolution API — grupo já configurado).
- Ignora mensagens `whatsapp_outgoing` e mensagens cujo autor é o próprio destinatário.

**Trigger no banco**
- Trigger `AFTER INSERT` em `chat_messages` que chama a edge function via `pg_net` (`net.http_post`) de forma assíncrona, passando `message_id`.

## 3. Configuração / Secrets

Pedir ao usuário gerar par VAPID (script local com `web-push generate-vapid-keys`) e adicionar como secrets:
- `VAPID_PUBLIC_KEY` (também exposto como `VITE_VAPID_PUBLIC_KEY` para o frontend).
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (mailto do escritório).

Evolution API e WhatsApp já configurados — reaproveitar.

## 4. UX

- Em `/chat` no mobile: se permissão não concedida, mostrar banner "Receber notificações neste celular" com botão.
- Em `Configurações → Perfil`: lista de dispositivos registrados com botão "remover".
- Som já existe no `useChatNotification` (toast). Mantém para quando a aba está aberta.

## Limitações importantes (avisar o usuário)

- **iPhone**: Web Push só funciona se o usuário **adicionar o app à Tela de Início** pelo Safari (iOS 16.4+). Sem isso, no iPhone só chega WhatsApp.
- **Android**: funciona direto no Chrome após permitir notificações.
- O Service Worker só registra na versão publicada (`vehub.lovable.app`), não no preview do editor.

## Detalhes técnicos

```text
chat_messages INSERT
   └── trigger pg_net → POST /chat-notify { message_id }
                          ├── Web Push para subscriptions do destinatário
                          └── Fallback WhatsApp (Evolution) p/ grupo Velocitä
```

- Lib do edge: `npm:web-push@3` para assinatura VAPID.
- `pg_net` precisa estar habilitado (extensão `pg_net`); incluir `CREATE EXTENSION IF NOT EXISTS pg_net` na migration.
- RLS de `user_push_subscriptions`: `auth.uid() = user_id` para SELECT/INSERT/DELETE.

## Entregáveis

1. Migration: tabela `user_push_subscriptions` + extensão pg_net + trigger.
2. Edge function `chat-notify`.
3. `public/manifest.webmanifest`, `public/sw.js`, ícones, meta tags em `index.html`.
4. `src/hooks/useWebPush.ts` + componente `EnableNotificationsBanner`.
5. Card "Notificações no celular" na página `Settings`.

## Pré-requisitos antes de implementar

Você precisa fornecer (ou aprovar a geração de) os secrets VAPID. Posso te passar o comando exato após aprovar este plano.
