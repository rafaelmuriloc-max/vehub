# Página de Tarefas no visual da imagem

Só muda a aparência da aba Kanban e do topo da página. Os dados, as regras e as outras abas (Lista, Ranking, Custo por Cliente, Cadastro) continuam iguais.

## Topo
- Linha de navegação "← Tarefas > Kanban" acima do título.
- Título "Tarefas" com o subtítulo à esquerda. À direita: busca grande "Buscar tarefas, clientes, responsáveis...", botão de ajustes, sino com contador de mensagens não lidas (abre o Chat) e o botão laranja "Nova Tarefa" com cantos arredondados.
- Abas com ícone e sublinhado laranja na aba ativa (como já está, com ajuste fino de espaçamento).

## Barra de filtros
- Uma linha de caixas brancas arredondadas, cada uma com ícone: Todos os clientes (com busca por digitação), Todos os responsáveis, Todas as tarefas, **Todos os prazos** (novo: Vencidas, Vencem hoje, Próximos 7 dias, Sem prazo) e Todas as prioridades.
- À direita: link azul "Limpar filtros" e botão "Filtros", que abre um painel com os filtros menos usados (Departamento e Status).

## Colunas
- Três colunas com cabeçalho: ícone redondo colorido (laranja em A Fazer, amarelo em Aguardando, verde em Concluído), título, contador em pílula (escura, cinza e verde), subtítulo, menu "..." e botão "+" que abre Nova Tarefa já no status da coluna.
- A coluna Concluído ganha um fundo verde bem claro.
- Coluna vazia: ícone de pasta com relógio, "Nenhuma tarefa aguardando" e o texto explicativo.
- Rodapé: "Mostrando X de Y tarefas" e o link "Ver todas →", que carrega mais cartões na própria coluna (substitui os botões Anterior/Próxima).

## Cartões
- Número, título em negrito, "código - nome da empresa", departamento.
- Selo de prioridade em pílula no canto (Média azul, Alta laranja, Urgente vermelho) e menu "⋮" com as ações que hoje ficam no rodapé: Concluir, Enviar para o cliente, Reenviar envio pendente e Excluir.
- Rodapé: bolinha com as iniciais do responsável + nome em etiqueta; data de prazo com ícone de calendário (vermelha quando vencida); anexos com clipe. Nos concluídos: data/hora da conclusão e selo verde com o tempo gasto (ex.: "3min").
- O cronômetro continua disponível dentro da tarefa.

## Detalhes técnicos
- Arquivo principal: `src/pages/Tasks.tsx` (COLUMN_META, filterBar, header e bloco do Kanban). Novo estado `filterDue` aplicado em `filteredTasks`; `kanbanLimit` por coluna (passo de 10) no lugar de `kanbanPage`.
- Contador do sino via `useUnreadCount`; ações do cartão em `DropdownMenu`; tempo gasto a partir dos registros já usados pelo `TimeTracker`.
- Cores via tokens semânticos (primary, muted, success/warning adicionados em `index.css`/`tailwind.config.ts` se faltarem).
- Validação: `bunx tsgo --noEmit` e build OK.
