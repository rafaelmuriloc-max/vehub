## Objetivo

Fazer com que os botões de opção de anexo (Arquivo, Imagem, etc.) no popover do chat fiquem com fundo laranja ao serem selecionados (clicados/ativos).

## Mudança

Arquivo: `src/components/chat/ChatInput.tsx` (linha 222)

Adicionar estados visuais laranja às classes do botão de opção dentro do `PopoverContent`:

- `active:bg-orange-300` — fundo laranja enquanto o botão está sendo clicado
- `focus:bg-orange-300 focus:outline-none` — fundo laranja quando o botão recebe foco (selecionado via teclado/clique)

Resultado da className final:
```
flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent focus:bg-orange-300 active:bg-orange-300 focus:outline-none text-sm transition-colors text-left
```

## Observação

Se a intenção for um estado "selecionado persistente" (manter laranja após escolher uma opção), seria necessário adicionar estado React para rastrear a opção ativa — confirme se é esse o comportamento desejado ou se o destaque temporário ao clicar/focar é suficiente.