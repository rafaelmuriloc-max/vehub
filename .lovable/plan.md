

# Notificação sonora e visual para novas mensagens fora do chat

## O que será feito
Criar um hook global que monitora novas mensagens via Realtime e, quando o usuário **não está na página `/chat`**, emite:
1. Um som de notificação
2. Um toast no canto inferior direito com o nome do contato e preview da mensagem

## Alterações

### 1. Criar arquivo de som `public/notification.mp3`
Usar um som curto de notificação gerado via Web Audio API (fallback) ou um arquivo mp3 simples.

### 2. Criar hook `src/hooks/useChatNotification.ts`
- Usa `useLocation()` para saber se está em `/chat`
- Assina Realtime em `chat_messages` para eventos INSERT
- Quando recebe mensagem com `message_type` diferente de `text` e `whatsapp_outgoing` (mensagem incoming):
  - Se `location.pathname !== '/chat'`:
    - Toca som via `new Audio()` ou Web Audio API
    - Exibe toast via `sonner` (toast do canto inferior) com nome da conversa e preview do conteúdo
- Busca o nome da conversa em `chat_conversations` para exibir no toast

### 3. Integrar em `AppLayout.tsx`
- Chamar `useChatNotification()` dentro do AppLayout para que funcione em todas as páginas (exceto `/chat`)

### Layout do toast
```text
┌──────────────────────────┐
│ 💬 Nova mensagem         │
│ João Silva: Olá, tudo... │
└──────────────────────────┘
```

## Som
Usar Web Audio API para gerar um beep curto programaticamente (sem necessidade de arquivo externo), com fallback silencioso se o navegador bloquear autoplay.

## Arquivos
- `src/hooks/useChatNotification.ts` (novo, ~50 linhas)
- `src/components/AppLayout.tsx` (~2 linhas: import + chamada do hook)

