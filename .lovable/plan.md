

# Adicionar botão de excluir obrigação na lista do calendário

## O que será feito
Adicionar um botão de excluir (ícone Trash2) em cada item da lista de obrigações do calendário (tanto na lista do dia selecionado quanto nas abas pendentes/concluídas do mês). Ao clicar, exibe um diálogo de confirmação e, se confirmado, exclui a `obligation_instance` e suas `obligation_activity_completions` associadas.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Importar AlertDialog
Adicionar imports de `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle`.

### 2. Novo estado
- `deleteInstanceId: string | null` — instância selecionada para exclusão.

### 3. Função `deleteInstance`
- Excluir completions: `delete from obligation_activity_completions where instance_id = ...`
- Excluir instância: `delete from obligation_instances where id = ...`
- Limpar estado, exibir toast, recarregar dados.

### 4. Botão na lista
Em cada card de obrigação (3 locais: lista do dia, aba pendentes, aba concluídas), adicionar um botão Trash2 com `stopPropagation` para não abrir o diálogo de detalhes. O botão seta `deleteInstanceId`.

### 5. AlertDialog de confirmação
Renderizar um `AlertDialog` controlado por `deleteInstanceId`, com título "Excluir obrigação", descrição de confirmação, e botões Cancelar/Excluir.

## Arquivos
- `src/pages/CalendarView.tsx`

