# Trazer os indicadores e gráficos do calendário para o dashboard

## Objetivo
Mostrar no dashboard os mesmos quatro cards de indicadores (A fazer, Atrasadas, Concluídas, Fora do prazo), o medidor "Desempenho geral da operação" e os medidores por departamento (Fiscal, Contábil, Pessoal) que hoje existem só na tela do calendário.

## Comportamento
- Os números são do mês corrente, sem filtros aplicados (o dashboard não tem barra de filtros).
- Cálculo idêntico ao do calendário: mesma regra de atrasadas, entregues fora do prazo, antecipação por feriado/fim de semana e comparação com o mês anterior.
- Aparência idêntica: mesmas cores, arcos com degradê, ponteiro e percentual dentro do medidor.
- O painel entra no topo do dashboard, acima dos painéis atuais (Clientes, Chamados, Tarefas, Obrigações), que continuam como estão.
- Enquanto carrega, o painel mostra um estado de carregamento; se falhar, mostra aviso com opção de tentar de novo.
- A tela do calendário continua exatamente igual.

## Detalhes técnicos
- Extrair de `src/pages/CalendarView.tsx` para um módulo compartilhado (`src/components/performance/`):
  - `GaugeArc`, `OfficeGauge`, `DepartmentGauge`;
  - os cards de KPI, hoje inline em `CalendarView.tsx`;
  - a lógica de `dashboardStats` e `departmentPerformance` em um hook (`usePerformanceStats`) que recebe instâncias, obrigações, clientes, conclusões, atividades, departamentos, filtros opcionais e mês/ano.
- Novo componente `OperationPerformance` que carrega os próprios dados via React Query: obrigações, departamentos, clientes (id/nome/regime), instâncias do mês corrente e do anterior e as conclusões via a RPC `get_calendar_month_completions` (mesma usada hoje pelo calendário).
- `CalendarView.tsx` passa a importar os componentes/hook extraídos, mantendo seus filtros e o mês selecionado como parâmetros — nenhuma mudança de cálculo ou layout lá.
- `src/pages/Dashboard.tsx` renderiza `<OperationPerformance />` como primeiro bloco do conteúdo.
- Validar com typecheck e build.
