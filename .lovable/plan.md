## Indicador de Usuários Logados no Chat

Adicionar, no cabeçalho da coluna de Conversas (logo abaixo do título "Conversas"), um menu recolhível "Usuários Logados" que, ao expandir, lista os usuários do sistema com um indicador colorido de status:

- 🟢 **Verde** — Online (aba aberta com sessão ativa)
- ⚪ **Cinza** — Logado mas inativo há mais de 30 min (sem enviar mensagem)
- 🔴 **Vermelho** — Offline (sem sessão ativa)

### Como detectar o status

Usar **Supabase Realtime Presence** num canal global `online-users`:

- Cada cliente, ao montar o `AppLayout` autenticado, entra no canal com `track({ user_id, last_activity_at })`.
- `last_activity_at` é atualizado (via `channel.track(...)` novamente) sempre que o usuário **envia uma mensagem no chat** (gatilho no `ChatInput` após enviar com sucesso). Inicialmente vale `now()` no track inicial.
- Outros clientes escutam `presence` (sync/join/leave) e mantêm um `Map<user_id, last_activity_at>`.

Classificação por usuário (calculada na UI, reagindo a cada minuto via `setInterval`):
- Presente no Map e `now - last_activity_at < 30min` → **verde**
- Presente no Map e `now - last_activity_at >= 30min` → **cinza**
- Ausente do Map → **vermelho**

Sem alterações no banco — Presence é efêmero.

### Componentes a criar

1. **`src/hooks/useOnlineUsers.tsx`** — Provider + hook.
   - `OnlineUsersProvider` monta o canal Presence quando há sessão (usado no `AppLayout`).
   - Expõe `{ presenceMap: Map<userId, lastActivityAt>, bumpActivity: () => void }`.
   - `bumpActivity()` reenvia `track()` com timestamp atual.

2. **`src/components/chat/LoggedUsersPanel.tsx`** — Collapsible no header do `ConversationList`, abaixo de "Conversas".
   - Título "Usuários Logados" + chevron + contagem `(X online)`.
   - Ao expandir: lista todos os `profiles` (já carregados) com avatar pequeno, nome e bolinha verde/cinza/vermelha. Ordena por status (verde → cinza → vermelho) e nome.
   - Tooltip na bolinha explica o significado e mostra "Ativo há Xmin" quando aplicável.

### Edições

- `src/components/AppLayout.tsx` — envolver children com `<OnlineUsersProvider>`.
- `src/components/chat/ConversationList.tsx` — montar `<LoggedUsersPanel/>` logo após o bloco de header (linha ~163), antes da busca. Buscar lista de profiles via hook próprio ou prop.
- `src/components/chat/ChatInput.tsx` — chamar `bumpActivity()` no sucesso do envio de mensagem (texto, mídia, áudio).

### Fora de escopo

- Persistir "última atividade" em tabela / histórico.
- Atualizar atividade por outros eventos (mouse/teclado fora do chat).
- Status manual (ausente/ocupado/invisível).
- Indicadores em outras telas além da coluna de Conversas.
