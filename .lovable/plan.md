# Notificações de chat no celular (somente app/PWA)

Apenas Web Push via PWA. Sem fallback WhatsApp. Destinatário: usuário **atribuído à conversa** + **admins** (grupo Velocitä interno).

## 1. PWA instalável

- `public/manifest.webmanifest` (nome "Velocitä", ícones 192/512, theme color navy `#0F172A`, `display: standalone`).
- `public/sw.js` mínimo: só listeners `push` (mostra notificação) e `notificationclick` (abre `/chat`). Sem cache de HTML.
- Registrar SW só fora do iframe/preview (registra apenas em produção).
- Meta tags iOS + `<link rel="manifest">` em `index.html`.

## 2. Subscription Web Push

- Hook `useWebPush`: pede permissão, registra `PushSubscription` com chave VAPID pública e salva no Supabase. Detecta iOS standalone.
- Banner "Ativar notificações" no topo de `/chat` (mobile) quando permissão != granted.
- Card "Notificações no celular" em `Settings → Empresa` (ou nova aba "Meu perfil") listando dispositivos e botão remover.

## 3. Tabela nova

- `user_push_subscriptions` (id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at).
- RLS: usuário gerencia só as próprias (SELECT/INSERT/DELETE por `auth.uid() = user_id`); service role lê tudo.

## 4. Disparo (edge function `chat-notify`)

- Recebe `{ message_id }`.
- Lê mensagem + conversa.
- Ignora se `message_type` for `text` enviado pelo próprio sistema, ou autor = destinatário.
- Determina destinatários: `assigned_to` ∪ admins (`user_roles.role = 'admin'`).
- Para cada usuário, busca `user_push_subscriptions` e envia Web Push (lib `npm:web-push@3` com VAPID).
- Remove subscription em 404/410.

## 5. Trigger de DB

- Habilita extensão `pg_net`.
- Trigger `AFTER INSERT` em `chat_messages` chama a edge function `chat-notify` via `net.http_post` passando `message_id`. Header com chave anon.

## 6. Secrets necessários

- `VAPID_PUBLIC_KEY` (gerada): `BKDn_tDoictqH6L-26JAeuCK7WflItbDHR9mVhw1PgCo1kfnQjRQgUne5J4_eKeQjKQQQJCS1mzKP7czMAz-VLc`
- `VAPID_PRIVATE_KEY` (gerada): `55kyLvaXcy9kZb6W4wNwbBmRHOm1IP-jgk_lXg9C1so`
- `VAPID_SUBJECT`: ex. `mailto:contato@velocita.com.br`

A pública também vai como `VITE_VAPID_PUBLIC_KEY` no `.env` do frontend.

## Limitações importantes

- **iPhone**: precisa "Adicionar à Tela de Início" pelo Safari (iOS 16.4+). Sem isso, push não chega.
- **Android**: funciona após permitir notificações no Chrome.
- Service Worker só ativa na versão publicada (`vehub.lovable.app`), não no preview do editor.

## Entregáveis

1. Migration: tabela `user_push_subscriptions` + extensão `pg_net` + trigger em `chat_messages`.
2. Edge function `chat-notify`.
3. `public/manifest.webmanifest`, `public/sw.js`, ícones, meta tags em `index.html`.
4. `src/hooks/useWebPush.ts` + `EnableNotificationsBanner` no topo do `/chat` mobile.
5. Card "Notificações no celular" em Settings.
