# Encaminhar mensagens

Adiciona ação **Encaminhar** no menu de cada mensagem (texto e mídias) permitindo reenviar para uma ou mais conversas existentes.

## Fluxo de UX

1. No menu "⋮" de uma mensagem (`MessageBubble`), nova opção **Encaminhar** (ícone `Forward`) entre Responder e Editar.
2. Ao clicar, abre um diálogo `ForwardMessageDialog` com:
   - Campo de busca de conversas (mesmo padrão do `NewConversationDialog`)
   - Lista de conversas com checkbox (multi-seleção, até 5)
   - Botão "Encaminhar" com loading
3. Ao confirmar, para cada conversa selecionada cria-se uma nova mensagem replicando `content`, `message_type` e `media_url` da original. Conversas WhatsApp disparam o envio via Evolution/Meta API conforme o tipo da conversa destino; conversas internas apenas inserem em `chat_messages`.
4. Toast de sucesso e fechamento do diálogo.

## Componentes / arquivos afetados

- `src/components/chat/MessageBubble.tsx` — nova prop `onForward?: () => void` e item de menu.
- `src/components/chat/MessageArea.tsx` — estado `forwardingMessage`, passa `onForward` para cada bubble e renderiza `ForwardMessageDialog`.
- `src/components/chat/ForwardMessageDialog.tsx` *(novo)* — UI de seleção e ação de envio.
- `src/pages/Chat.tsx` — sem mudanças significativas (o diálogo se conecta ao Supabase e às edge functions já existentes).

## Detalhes técnicos

- Para WhatsApp: detectar `whatsapp_phone` da conversa destino. Se for mídia, reutilizar `media_url` original chamando a edge function `whatsapp-send-media` (já existente). Para texto, `whatsapp-send-message`.
- Para conversas internas: `insert` direto em `chat_messages` com `sender_id = auth.uid()`.
- Marcar a mensagem encaminhada com prefixo visual? Não — manter conteúdo original (padrão WhatsApp não exige rótulo "encaminhada" para esta versão; pode ser adicionado depois).
- Limite de 5 destinos por vez para evitar abuso.

## Fora de escopo

- Indicador "Encaminhada" na bolha (pode ser feature futura).
- Encaminhar várias mensagens selecionadas simultaneamente.
