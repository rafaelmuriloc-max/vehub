# Aumentar ainda mais os gauges departamentais do calendário

## Objetivo
Aumentar a altura e a largura dos medidores semicirculares dos departamentos (Fiscal, Contábil, Depto Pessoal) na tela Calendário, sem alterar cálculos, dados, cores, degradês, ponteiros ou comportamento dos filtros.

## Alterações previstas

### 1. `src/pages/CalendarView.tsx` — componente `GaugeArc`
- Tornar o SVG parametrizável por tamanho, adicionando props opcionais (ex.: `width`, `height`, `cx`, `cy`, `radius`) ou um prop `size` com presets.
- Preservar o viewBox padrão (`220×110`) para os medidores que já o usam (OfficeGauge).
- Para o tamanho departamental ampliado, usar viewBox proporcionalmente maior (ex.: `260×130` ou `280×140`) e ajustar `cx`, `cy`, `radius`, `strokeWidth` e `valueFontSize` para manter a proporção visual.

### 2. `src/pages/CalendarView.tsx` — componente `DepartmentGauge`
- Aumentar o container do SVG de `h-[95px] w-[180px]` / `min-w-[200px]` para aproximadamente `h-[120px] w-[220px]` / `min-w-[240px]`.
- Aumentar proporcionalmente `strokeWidth` (ex.: de 18 para 22) e `valueFontSize` (ex.: de 28px para 32px).
- Manter o nome do departamento e a comparação “vs. mês anterior” abaixo do medidor.

### 3. Container dos departamentos
- Ajustar o `div` pai (`flex overflow-x-auto ...`) para acomodar gauges maiores sem cortar ou forçar scroll desnecessário em desktop.
- Garantir que, em telas menores, os gauges continuem scrollando horizontalmente sem quebra.

## Não será alterado
- Cálculo de desempenho (`departmentPerformance`).
- Cores, degradês e formato do ponteiro.
- Medidor geral de desempenho da operação (`OfficeGauge`).
- Departamentos exibidos (Fiscal, Contábil, Pessoal).
- Filtros, calendário, listas e cronômetros.

## Validação
- Typecheck (`bunx tsgo --noEmit -p tsconfig.app.json`).
- Build de produção.
- Visual: gauges departamentais visivelmente maiores, sem distorção, corte ou quebra de linha no desktop; scroll horizontal preservado em telas estreitas.
