## Objetivo

Adaptar o dialog "Editar Tarefa" (`src/components/tasks/TaskEditDialog.tsx`) para mobile, sem alterar lógica.

## Mudanças

**`DialogContent`**
- Largura responsiva: `w-[calc(100vw-1rem)] sm:max-w-lg`
- Altura: `max-h-[95vh] sm:max-h-[90vh]`
- Padding compatível com mobile

**Grid de campos (Status/Prioridade/Prazo/Cliente/Departamento)**
- Trocar `grid-cols-2` por `grid-cols-1 sm:grid-cols-2`
- Ajustar `col-span-2` para `sm:col-span-2`

**Linha de upload de anexos**
- Trocar `flex items-center gap-2` por `flex flex-col sm:flex-row sm:items-center gap-2` para o input `type="file"` + botão "Anexar" não estourarem em telas estreitas
- Botão "Anexar" com `w-full sm:w-auto`

**Itens de anexo já existentes**
- Manter, mas garantir `min-w-0` no container e `truncate` (já está) para nome do arquivo não estourar

**Badges "Atribuir a"**
- Já usa `flex flex-wrap`, sem mudança

Nenhuma alteração em backend, hooks, queries ou comportamento.
