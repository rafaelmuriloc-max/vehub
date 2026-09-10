# Ajuste do topo da tela de Calendário

## Objetivo
Remover a barra de pesquisa da barra superior do Calendário e colocar os três botões de visualização (Calendário, Documentos, Tarefas) no lugar dela.

## Alterações previstas

### `src/pages/CalendarView.tsx`
1. **Remover a barra de pesquisa do topo**
   - Excluir o `<Input>` de busca, o ícone `Search`, o botão de limpar (`X`) e o container `relative w-[430px]`.
   - Remover o estado `headerSearch`, `setHeaderSearch` e a função `submitHeaderSearch`.
   - Remover o ícone `Search` do import do `lucide-react` (verificar se não é usado em outro lugar do arquivo).

2. **Colocar os botões de visualização no topo**
   - No mesmo container superior (`hidden h-11 ... lg:flex`), à esquerda, inserir os três botões que alternam entre `calendar`, `documents` e `tasks`.
   - Manter à direita os ícones de notificações, ajuda, separador e avatar do usuário.

3. **Preservar acesso mobile**
   - A barra superior fica visível apenas em `lg:flex`. Para não perder os botões em telas menores, manter o grupo atual de botões abaixo do subtítulo, mas exibi-lo apenas abaixo do breakpoint `lg` (`lg:hidden`).

4. **Ajustar estilo dos botões no topo**
   - Usar botões compactos (`size="sm"`) com ícones e rótulos, respeitando a altura da barra (`h-9` ou similar).
   - Manter as variantes `default` para a view ativa e `outline` para as inativas.

## Critérios de aceitação
- A barra de busca não aparece mais no topo da página de Calendário.
- Os botões Calendário / Documentos / Tarefas aparecem na barra superior, à esquerda, no desktop.
- Em telas menores, os botões continuam acessíveis abaixo do subtítulo.
- O build/typecheck continua passando.
