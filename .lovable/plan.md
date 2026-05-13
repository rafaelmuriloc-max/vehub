## Ajuste

Aumentar a margem inferior da caixa de mensagem no chat para ela não ficar colada ao fim da tela em dispositivos móveis.

### Mudança

**`src/components/chat/ChatInput.tsx`** (linha 155)

Substituir o padding inferior do container do input:

- De: `pb-[env(safe-area-inset-bottom,2px)]`
- Para: `pb-[calc(env(safe-area-inset-bottom,0px)+16px)]`

Isso mantém o respeito à safe-area do iOS e adiciona ~16px extras de respiro abaixo do campo de texto e dos botões.

### Verificação

Recarregar a tela do chat no preview mobile (402×632) e confirmar que a caixa "Digite uma mensagem" aparece com mais espaço abaixo, sem cortar conteúdo nem cobrir mensagens.
