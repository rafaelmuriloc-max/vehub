# Filtro por departamento no painel de Tarefas

## Situação atual
Hoje o filtro de departamento fica escondido dentro do botão "Filtros", por isso é difícil de encontrar.

## O que muda
- Um seletor **Departamento** passa a aparecer direto na barra de filtros, ao lado de Responsável, Modelo, Vencimento e Prioridade.
- As opções serão "Todos os departamentos", cada departamento cadastrado e "Sem departamento", para as tarefas que não têm um departamento definido.
- O filtro vale para o quadro (Kanban), a lista e o calendário, e também para os números das colunas.
- O seletor duplicado que hoje fica dentro de "Filtros" sai de lá.
- A opção "Limpar filtros" também volta o departamento para "Todos".

## Detalhes técnicos
- Arquivo: `src/pages/Tasks.tsx`. Aproveitar o estado `filterDepartment` que já existe e mover o `Select` do popover para a barra principal.
- Tratar o valor `none` no filtro com `!t.department_id`.
- Não há mudança no banco de dados.
