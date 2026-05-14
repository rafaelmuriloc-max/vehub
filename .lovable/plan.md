## Adicionar botão de emojis ao lado do botão de anexos

Adicionar um botão Smile (Lucide) ao lado direito do botão "+" (anexos) em `src/components/chat/ChatInput.tsx`, abrindo um Popover com um picker de emojis. Ao clicar em um emoji, ele é inserido na posição do cursor da textarea.

### Mudanças

1. Instalar `emoji-picker-react` (componente leve e popular para React).
2. Em `ChatInput.tsx`:
   - Importar `Smile` do `lucide-react` e o `EmojiPicker` (lazy/dynamic import opcional para não pesar o bundle).
   - Novo estado `emojiOpen`.
   - Adicionar um `<Popover>` com trigger `Smile` logo após o Popover do "+", antes do `<textarea>`.
   - Handler `onEmojiClick` insere `emoji.emoji` na posição do cursor (`selectionStart/End`) e mantém o foco no textarea.
   - Esconder o botão durante a gravação de áudio (mesma lógica do "+").

Sem alterações de backend, RLS, schema ou outros componentes.
