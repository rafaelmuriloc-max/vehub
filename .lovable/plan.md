## Objetivo

Adicionar uma aba "Excluídas" no calendário mostrando obrigações excluídas (soft delete), com possibilidade de restaurar.

## Mudanças

### 1. Banco (migração)
- Adicionar coluna `deleted_at timestamptz NULL` em `obligation_instances`.
- Índice parcial `where deleted_at is null` para performance.

### 2. Soft delete em `CalendarView.tsx`
- Substituir os `.delete()` em `deleteInstance()` e no bulk delete por `update({ deleted_at: now })` em `obligation_instances`. Manter as completions (não apagar).
- Em `loadData()` (linha 151), filtrar `.is('deleted_at', null)` ao listar instâncias do mês.
- Criar uma segunda query (lazy, só quando a aba "Excluídas" é aberta) que busca instâncias com `deleted_at not null` no mês visível.

### 3. UI — nova aba "Excluídas"
- Hoje o mês tem tabs "A fazer / Atrasados / Concluídos" (3 cards). Adicionar 4ª tab **Excluídas** (cinza).
- Reaproveitar o mesmo card-list da aba de concluídas, com fundo `bg-muted/40 border-dashed` e badge cinza.
- Cada item terá botão **Restaurar** (ícone `Undo2`) ao invés de Concluir, que faz `update({ deleted_at: null })` e recarrega.
- Botão lixeira na aba Excluídas executa hard delete (igual hoje).
- Paginação reaproveita o padrão das outras abas.

### 4. Demais telas
- Não alterar `Obligations.tsx`, `Documents.tsx`, `ClientObligationsTab.tsx` etc. nesta entrega. Se necessário ocultar excluídas globalmente, fica para depois — escopo aqui é só o calendário.

## Fora do escopo
- Nada de mudanças na lista do dia (só na visão mensal).
- Sem alterar RLS além do necessário (coluna nova só precisa de update permitido — já coberto pelas policies atuais de admin).
