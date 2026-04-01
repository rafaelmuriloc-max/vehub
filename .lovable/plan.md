

# Assinar mensagens WhatsApp com o nome do usuário logado

## Problema
As mensagens enviadas pelo chat aparecem com o nome do usuário na tela, mas no WhatsApp do cliente chegam apenas o texto puro, sem identificar quem enviou.

## Solução
Prefixar o texto enviado via WhatsApp com o nome do usuário no formato:
```
*Nome do Usuário:*
texto da mensagem
```

## Alterações

### 1. `src/pages/Chat.tsx`
- No `sendMessage`, ao chamar `whatsapp-send-text`, passar o `senderName` obtido do profile do usuário logado (já disponível via `useAuth()` → `profile.full_name`)

### 2. `supabase/functions/whatsapp-send-text/index.ts`
- Receber `senderName` no body (opcional)
- Ao montar o texto para envio (tanto Meta API quanto Evolution API), prefixar com `*${senderName}:*\n` quando `senderName` estiver presente
- O conteúdo salvo no `chat_messages` permanece sem prefixo (apenas o texto original), pois a assinatura é apenas para o destinatário externo

## Arquivos
- `src/pages/Chat.tsx`
- `supabase/functions/whatsapp-send-text/index.ts`

