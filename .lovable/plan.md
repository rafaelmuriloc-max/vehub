# Novo layout da tela de Tarefas

Reproduzir na tela de Tarefas exatamente a composição da imagem de referência, sem mudar nenhuma regra de negócio, filtro, paginação ou ação existente.

## O que muda visualmente

**Cabeçalho**
- Título "Tarefas" grande, em azul-marinho, com subtítulo "Organize e acompanhe todas as tarefas da sua equipe." logo abaixo.
- Botão "Nova Tarefa" laranja, arredondado, com ícone de "+", alinhado à direita na mesma linha do título.

**Abas**
- Kanban, Lista, Ranking, Custo por Cliente e Cadastro passam a ser abas em linha, com ícone à esquerda de cada rótulo, sem fundo cinza: a aba ativa fica laranja com uma barra inferior laranja; as demais em cinza.

**Barra de filtros**
- Um único painel branco com cantos arredondados e sombra suave, contendo os filtros lado a lado: clientes, departamentos, tarefas, responsáveis, status, prioridades e campo de busca.
- Cada seletor ganha um ícone à esquerda (pessoa, prédio, documento, grupo, etiqueta, funil) e a busca mantém a lupa.
- O contador de resultados e o botão "Limpar filtros" continuam aparecendo quando há filtro ativo.

**Colunas do Kanban**
- Cada coluna vira um painel claro arredondado com cabeçalho próprio:
  - ícone quadrado colorido (azul para "A Fazer", âmbar para "Aguardando", verde para "Concluído"),
  - nome da coluna em maiúsculas, selo escuro com a quantidade total,
  - linha de apoio: "Tarefas pendentes para execução", "Tarefas em espera, aguardando retorno", "Tarefas finalizadas",
  - ícone de reticências à direita (apenas decorativo, sem menu).
- Coluna vazia mostra estado ilustrado central: círculo cinza com ícone de relógio, "Nenhuma tarefa aguardando" e a frase de apoio "Quando uma tarefa estiver em espera, ela aparecerá aqui."

**Cards**
- Cartão branco com borda leve: número da tarefa em cinza à esquerda e selo de prioridade à direita; título em negrito; cliente e departamento em cinza; linha "Solicitado em ... por ..." com ícone de calendário; "Concluído em ..." em verde com ícone de confirmação; responsáveis como pílulas coloridas com iniciais; "Prazo:" em vermelho/laranja com ícone.
- Rodapé separado por linha fina: cronômetro (ícone play + tempo) e contadores de anexos à esquerda; "Para o cliente" e a lixeira à direita.
- Destaque verde para tarefas concluídas dentro do prazo permanece.

## Fora de escopo
- Nenhuma mudança em banco de dados, consultas, edge functions ou permissões.
- Nenhuma alteração em filtros, ordenação da coluna "A Fazer", paginação de 10 cards, upload de anexos, cronômetro, exclusão ou movimentação de status.
- A busca global do topo do site e o menu lateral não são alterados.

## Detalhes técnicos
- Arquivo: `src/pages/Tasks.tsx` (apenas apresentação/JSX e classes).
- Usar tokens semânticos já existentes em `src/index.css` / `tailwind.config.ts` (navy, laranja, verde, âmbar); nenhuma cor literal nova em componente.
- Ícones adicionais do `lucide-react`: `LayoutGrid`, `List`, `BarChart3`, `Wallet`, `ClipboardList`, `User`, `Building2`, `FileText`, `Users`, `Tag`, `Filter`, `MoreHorizontal`, `Clock`, `CalendarDays`, `CheckCircle2`, `Play`.
- Extrair um pequeno componente local `KanbanColumnHeader` e um `EmptyColumnState` dentro do próprio arquivo para manter o JSX legível.
- Manter `statusColumns`, `filteredTasks`, `kanbanPage`, `KANBAN_PAGE_SIZE` e todos os handlers exatamente como estão.
- Validação: `tsgo`/build do projeto e conferência visual no preview em desktop e mobile.
