# Mover botões de exportar e nova obrigação para a barra de visualização

## Objetivo
Colocar os botões **Exportar** e **Nova obrigação** ao lado dos botões de visualização (Calendário/Documentos/Tarefas), exibindo apenas os ícones.

## Alterações previstas

### `src/pages/CalendarView.tsx`
1. **Barra superior (desktop)**
   - No grupo esquerdo, logo após o botão **Tarefas**, adicionar:
     - Botão de **Exportar** (`Download`) como ícone apenas, `variant="outline"`, `size="icon"`, altura `h-8`.
     - Botão de **Nova obrigação** (`Plus`) como ícone apenas, com as mesmas cores laranja do botão atual, `size="icon"`, altura `h-8`, visível apenas para administradores (`isAdmin`).
   - Manter à direita os ícones de notificações, ajuda e avatar do usuário.

2. **Grupo mobile (abaixo do subtítulo)**
   - Como a barra superior fica oculta em telas menores, adicionar os mesmos botões de ícone único (**Exportar** e **Nova obrigação**) ao final do grupo que já contém os botões Calendário/Documentos/Tarefas.
   - O grupo inteiro continua visível apenas abaixo do breakpoint `lg` (`lg:hidden`).

3. **Remover botões do subtítulo**
   - Retirar o botão **Exportar** e o botão **Nova obrigação** da linha que fica ao lado da saudação/ data, pois eles serão movidos para a barra de visualização.

4. **Acessibilidade**
   - Adicionar `aria-label` nos botões de ícone único para manter a descrição acessível.

## Critérios de aceitação
- Os botões Exportar e Nova obrigação aparecem ao lado do botão Tarefas na barra superior, sem texto.
- Em telas menores, os mesmos ícones aparecem ao lado dos botões de visualização abaixo do subtítulo.
- Os botões de texto Exportar/Nova obrigação desaparecem da linha da saudação.
- O build/typecheck continua passando.
