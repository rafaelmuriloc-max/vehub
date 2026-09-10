# Plano: aumentar altura e largura dos gráficos de desempenho dos departamentos

## Objetivo
Aumentar o tamanho dos medidores/gauges do painel **Desempenho geral dos departamentos** na tela Calendário, deixando-os mais visíveis sem alterar o layout geral.

## Alterações previstas

### 1. `src/pages/CalendarView.tsx`
- No componente `DepartmentGauge`, aumentar as dimensões do container do SVG e, proporcionalmente, o tamanho da fonte do percentual e os espaçamentos.
- Ajustar o container pai (`<div className="flex overflow-x-auto ...">`) para acomodar os gauges maiores, se necessário.
- Preservar o degradê, o ponteiro, o posicionamento do número na base do arco e a comparação percentual abaixo.

## Não será alterado
- Lógica de cálculo de desempenho.
- Cores, degradês e formato do ponteiro.
- Gauge geral de desempenho da operação.
- Departamentos exibidos (Fiscal, Contábil, Pessoal).

## Validação
- Typecheck.
- Build de produção.
- Visual: gauges departamentais visivelmente maiores, sem quebrar a linha ou cortar o card.
