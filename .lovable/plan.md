# Filtro por datas no card de Tarefas do dashboard

## Objetivo
Permitir que o usuário escolha o período de exibição do card "Tarefas do mês" no dashboard, em vez de ficar travado no mês corrente.

## O que será feito

### `src/components/dashboard/TasksPanel.tsx`
- Adicionar um seletor de período no cabeçalho do card, à esquerda do botão "Ver tudo".
- Presets disponíveis:
  - Mês atual (padrão)
  - Últimos 7 dias
  - Últimos 30 dias
  - Ano atual
  - Personalizado
- Para o modo "Personalizado", usar Popover + Calendar em modo range (`mode="range"`), seguindo o padrão Shadcn já usado no projeto.
- Estado local: `period` (`'month' | 'last7' | 'last30' | 'year' | 'custom'`) e `dateRange` (`{ from?: Date; to?: Date }`).
- Calcular `start` e `end` a partir do período selecionado:
  - `month`: 1º dia do mês corrente até o 1º dia do próximo mês.
  - `last7`: hoje − 6 dias até amanhã.
  - `last30`: hoje − 29 dias até amanhã.
  - `year`: 1º de janeiro até 1º de janeiro do ano seguinte.
  - `custom`: `dateRange.from` (00:00) até `dateRange.to + 1 dia` (00:00), ou mês atual se incompleto.
- Incluir o período na `queryKey` do `useQuery` para refetch automático quando o filtro mudar.
- Aplicar o recote nas consultas:
  - Pendentes, Em andamento, Concluídas e Atrasadas passam a usar `start`/`end` no `due_date`.
  - Pendentes sem data de vencimento continuam somados a Pendentes.
  - "Hoje" e "Ranking de hoje" permanecem sempre do dia atual, independente do filtro, pois são métricas diárias.
- Atualizar o título e subtítulo do card dinamicamente:
  - Título: "Tarefas" (genérico) ou "Tarefas do período".
  - Subtítulo: descrição do período selecionado (ex.: "01/09/2026 a 30/09/2026").

### Componentes reutilizados
- `Popover`, `PopoverContent`, `PopoverTrigger` de `@/components/ui/popover`.
- `Calendar` de `@/components/ui/calendar`.
- `Button` e `Select` de `@/components/ui`.
- `format` do `date-fns` para exibição das datas.

## Critérios de aceitação
- O card exibe um seletor de período funcional no cabeçalho.
- Ao trocar o período, as métricas de Pendentes, Em andamento, Concluídas e Atrasadas são recalculadas para o novo recorte.
- O período "Personalizado" permite escolher duas datas via calendário.
- O layout do Dashboard e o card de Obrigações não são alterados.
- "Hoje" e "Ranking de hoje" continuam refletindo o dia atual.

## Não inclui
- Alterações no backend, banco ou Edge Functions.
- Alterações no card de Obrigações ou em outras páginas.
