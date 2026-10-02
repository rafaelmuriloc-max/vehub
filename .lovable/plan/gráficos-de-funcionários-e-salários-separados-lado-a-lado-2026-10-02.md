# Gráficos de funcionários e salários separados, lado a lado

## O que muda
- O gráfico único "Evolução de funcionários e salários" vira dois gráficos, um ao lado do outro:
  - **Esquerda: Funcionários.** Colunas laranja com a quantidade em cima de cada uma.
  - **Direita: Salários.** Colunas verdes com o total do mês em letra branca na base de cada coluna (ex.: "R$ 774,2 mil"), seguindo o seu último pedido.
- Os seletores Mensal / Trimestral / Anual e o período ficam no topo e valem para os dois gráficos ao mesmo tempo.
- As caixas "Funcionários" e "Salários (R$)" saem, porque cada gráfico já mostra uma coisa só.
- No celular, os dois gráficos ficam um embaixo do outro.
- Ao passar o mouse, cada gráfico continua mostrando o valor exato e quantas empresas entraram no mês. Os dois continuam seguindo a busca e os filtros.

## Detalhes técnicos
- `src/components/personnel/PersonnelEvolutionChart.tsx`: manter o cabeçalho com granularidade e período e, abaixo dele, um `grid grid-cols-1 lg:grid-cols-2 gap-4` com dois cartões. Cada cartão terá um `BarChart` com eixo Y próprio. O de funcionários usa um `LabelList` no topo. O de salários usa colunas na cor `success` e um `LabelList` customizado, com texto em `primary-foreground` perto da base. Remover os estados `showEmp`/`showSal`, a Line/Area e o `SalaryPill`.
