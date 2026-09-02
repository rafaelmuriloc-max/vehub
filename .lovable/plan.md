# Adicionar coluna Categoria na lista de Chamados

## Objetivo
Incluir na tabela de chamados uma coluna informativa chamada **Categoria**, que exibe o nome do departamento vinculado ao chamado (`department_id`).

## Alterações

### Frontend
- Arquivo: `src/pages/Tickets.tsx`
  - Adicionar `<th className="...">Categoria</th>` no cabeçalho da tabela, posicionada logo após a coluna `#`.
  - Adicionar `<td>` correspondente nas linhas, renderizando `deptMap[t.department_id] ?? '—'`.
  - Ajustar `colSpan` do estado vazio de `9` para `10` para refletir a nova coluna.

## Critérios de aceitação
- A lista de chamados passa a exibir uma coluna "Categoria".
- Cada chamado mostra o nome do departamento ou "—" quando não houver departamento.
- Layout e paginação permanecem intactos.
- Typecheck/build passam sem erros.
