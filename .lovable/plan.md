

# Melhorar UI/UX do Calendário de Obrigações

## Objetivo
Refinar visual e experiência do calendário e das listas de obrigações com melhor hierarquia visual, espaçamento, interatividade e feedback.

## Mudanças no `src/pages/CalendarView.tsx`

### 1. Header da página
- Adicionar ícone de calendário ao título e subtitle descritivo
- Filtros com labels acima e visual mais integrado num card de filtros

### 2. Calendário (card esquerdo)
- Aumentar altura mínima das células para `min-h-[80px]`
- Mostrar contagem de obrigações por tipo dentro do dot (tooltip ou número ao lado)
- Destacar dia atual com fundo circular no número
- Dia selecionado com borda mais forte e sombra sutil
- Hover com transição suave e escala leve
- Legenda com fundo sutil e padding

### 3. Lista do dia (card direito)
- Cabeçalho com badge mostrando contagem total
- Estado vazio com ícone ilustrativo (CalendarDays)
- Rows com bordas arredondadas e espaçamento entre elas (usar cards individuais em vez de table crua)
- Badge de departamento ao lado da obrigação
- Indicador de progresso (ex: "2/5 atividades") em cada item

### 4. Lista do mês (card inferior)
- Mesmo tratamento visual das rows
- Coluna "Status" com barra de progresso ou badge (Pendente/Concluída)
- Agrupar visualmente por dia com separador ou agrupamento

### 5. Dialog de atividades
- Barra de progresso no topo do dialog (ex: 3/5 concluídas)
- Cards de atividade com cores de borda indicando status
- Botões de upload mais estilizados (Button component em vez de label crua)
- Animação sutil ao completar atividade

### 6. Paginação
- Estilizar com tamanho menor e alinhamento à direita
- Mostrar "Mostrando X-Y de Z" antes da paginação

### Detalhes técnicos
- Imports adicionais: `CalendarDays, Clock, Building2, ListChecks` do lucide-react, `Progress` de ui/progress
- Substituir table rows da lista do dia por cards empilhados para melhor visual
- Manter table na lista do mês mas com striped rows (`even:bg-muted/30`)
- Calcular progresso por instância: `completedCount / totalActivities`
- Sem mudanças no banco de dados

