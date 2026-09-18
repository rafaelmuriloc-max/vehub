# Botão de voltar ao calendário nas telas Documentos e Tarefas

## Objetivo
Ao abrir as visões "Documentos" e "Tarefas" a partir do calendário, mostrar um botão de voltar (seta para a esquerda) que retorna à visão do calendário, sem recarregar a página.

## Alterações
Em `src/pages/CalendarView.tsx` (componente `CalendarView`, final do arquivo):
- Quando `view` for `'documents'` ou `'tasks'`, renderizar antes do conteúdo um botão de voltar:
  - `Button` variante `ghost`/`outline` pequena, com ícone `ArrowLeft` e rótulo "Voltar ao calendário" (no mobile, apenas o ícone).
  - `onClick` chama `setView('calendar')`.
- Nada muda na visão `'calendar'` (sem botão de voltar lá).
- As telas `Documents` e `Tasks` permanecem intocadas.

## Fora de escopo
- Nenhuma mudança de banco, dados, edge functions ou navegação por URL (continua tudo dentro da rota `/calendar`).

## Validação
- Typecheck (`bunx tsgo --noEmit`) e build sem erros.
- Conferir no preview: abas Documentos e Tarefas exibem o botão de voltar acima do título; clicar retorna ao calendário mantendo filtros/estado carregado.
