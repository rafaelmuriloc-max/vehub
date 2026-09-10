# Posicionar botões Calendário/Documentos/Tarefas abaixo do subtítulo

## Objetivo
Mover os três botões de visão (Calendário, Documentos, Tarefas) do topo isolado da página para logo abaixo da frase "Aqui está o panorama das suas obrigações e prazos.", alinhados à direita, mantendo a funcionalidade de alternância entre as abas.

## Alterações
- Em `src/pages/CalendarView.tsx`:
  - Remover o bloco de botões do topo do componente `CalendarView` (wrapper).
  - Passar o estado `view` e o setter `setView` como props para `CalendarMain`.
  - Inserir os três botões de visão dentro do cabeçalho de `CalendarMain`, logo abaixo da linha que contém a saudação e os botões Exportar/Nova obrigação.
  - Alinhar o grupo de botões à direita (`flex justify-end`) e manter o mesmo estilo visual: ícones, rótulos ocultos em telas pequenas, variante `default` para o ativo e `outline` para os inativos.
- Preservar o comportamento atual de alternar entre `<CalendarMain />`, `<Documents />` e `<Tasks />`.

## Fora de escopo
- Nenhuma alteração em banco de dados, edge functions, autenticação ou lógica de cálculo.
- Não modificar os cards de KPI, gauges, filtros, calendário, listas ou cronômetros.

## Validação
- Verificar alinhamento no desktop e empilhamento adequado no mobile.
- Confirmar que os botões continuam alternando as visões.
- Rodar typecheck/build e conferir logs de erro.
