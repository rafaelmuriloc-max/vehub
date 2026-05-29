## Problema

O painel "Usuários Logados" (`src/components/chat/LoggedUsersPanel.tsx`) classifica cada usuário como **Online / Inativo (>30 min) / Offline** usando o `presenceMap` do hook `useOnlineUsers`. Hoje o resultado fica errado por três motivos:

1. **`last_activity_at` quase nunca é atualizado.** Só é gravado no `track()` inicial e em `ChatInput` quando o usuário envia mensagem. Quem está usando o sistema normalmente (CRM, tarefas, etc.) aparece como "Inativo" depois de 30 min, mesmo digitando.
2. **Sair da aba = offline imediato.** Quando o tab é fechado, o presence é removido na hora, sem janela de tolerância — abas que recarregam piscam como "Offline".
3. **Resubscribe a cada rotação de token.** O `useEffect` tem `session?.access_token` como dependência, então o canal é destruído/recriado toda vez que o Supabase rota o JWT, derrubando temporariamente o presence de todo mundo (visível nos logs: `online users: 0` logo depois de `SUBSCRIBED`).

## Solução

### 1. Heartbeat global de atividade (`useOnlineUsers`)
- Registrar listeners de `mousemove`, `keydown`, `click`, `touchstart`, `visibilitychange` e `focus` no `window` dentro do `OnlineUsersProvider`.
- Manter um `lastActivityRef` em memória atualizado por esses eventos.
- A cada 30 s (e quando a aba volta a ficar visível), chamar `channel.track({ user_id, last_activity_at: lastActivityRef.current })`. Usar throttle para não floodar o realtime.
- Manter o `bumpActivity` exportado (atualiza o ref + força um track imediato) — `ChatInput` continua chamando.

### 2. Não recriar o canal quando o token rotaciona
- Remover `session?.access_token` das deps do `useEffect` principal; deixar só `user?.id`.
- Mover `supabase.realtime.setAuth(token)` para um `useEffect` separado que reage a `session?.access_token` sem desmontar o canal.
- Manter o `onAuthStateChange` apenas para chamar `setAuth` no token novo.

### 3. Janela de tolerância para "offline"
- No `LoggedUsersPanel`, manter um `lastSeenRef: Map<user_id, number>` que armazena o último `last_activity_at` visto via presence.
- Atualizar esse mapa sempre que `presenceMap` mudar (merge: pega o maior valor).
- `classify(lastSeen, now)`:
  - `online`  → visto há < 2 min
  - `idle`    → visto há ≥ 2 min e < 30 min
  - `offline` → visto há ≥ 30 min ou nunca visto
- Assim, recarregar a aba ou trocar token não derruba ninguém para "Offline" no painel.

### 4. Ajustes de UI
- Atualizar os tooltips (`dotLabel` / `title`) para refletir os novos limites (ex.: "Inativo há X min").
- Manter o contador do cabeçalho (`onlineCount`) usando a nova classificação.

## Arquivos afetados
- `src/hooks/useOnlineUsers.tsx` — heartbeat, listeners globais, separar setAuth do subscribe.
- `src/components/chat/LoggedUsersPanel.tsx` — `lastSeenRef`, nova função `classify`, textos de status.

## Fora de escopo
- Persistir "última vez online" no banco (atualmente é só em memória/realtime — manter assim).
- Mudanças no `task-notify-client` ou em outros fluxos.
