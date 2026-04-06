

# Exclusão em lote de obrigações no calendário

## O que será feito

Adicionar checkboxes em cada item das listas de obrigações (tanto na lista do dia selecionado quanto na lista mensal), com uma barra de ações flutuante que aparece quando há itens selecionados, permitindo excluir todos de uma vez.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Novo estado de seleção
- `selectedInstanceIds: Set<string>` — IDs das instâncias selecionadas
- `showBulkDeleteConfirm: boolean` — controla o AlertDialog de confirmação em lote
- Limpar seleção ao mudar de mês, dia ou aba

### 2. Checkbox em cada item da lista
- Adicionar um `Checkbox` à esquerda de cada card (listas do dia e do mês, abas pending e completed)
- Click no checkbox alterna o item na seleção (com `stopPropagation` para não abrir o detalhe)
- Botão "Selecionar todos" no header de cada aba para marcar/desmarcar todos os itens visíveis

### 3. Barra de ações em lote
- Quando `selectedInstanceIds.size > 0`, exibir uma barra fixa no rodapé do card com:
  - Texto "{N} selecionado(s)"
  - Botão "Excluir selecionados" (variante destructive)
  - Botão "Limpar seleção"

### 4. Função `deleteSelectedInstances`
- Reutiliza a mesma lógica do `deleteInstance` existente, iterando sobre os IDs selecionados
- Deleta completions e depois instances para cada ID
- Exibe toast de sucesso e recarrega dados

### 5. AlertDialog de confirmação em lote
- Similar ao existente, mas com mensagem "Tem certeza que deseja excluir {N} obrigações?"

Nenhuma alteração em tabelas, RLS ou outros arquivos.

