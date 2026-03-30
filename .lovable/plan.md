

# Melhorar gráfico de Regime Tributário × Segmento

## Problema atual
O gráfico de barras empilhadas está visualmente genérico - barras grandes e desproporcionais, sem refinamento visual, tooltip básico, e a legenda padrão do recharts sem personalização.

## Direção estética
Seguindo a skill: tom **refined/editorial**, consistente com os donuts já existentes na página. Manter coesão com o design system Navy + Orange.

## Mudanças em `src/pages/Clients.tsx` (linhas ~1045-1081)

### 1. Trocar para barras horizontais agrupadas com proporção percentual
- Usar `BarChart layout="vertical"` para melhor legibilidade dos nomes dos regimes
- Normalizar para 100% (percentual) em vez de valores absolutos, mostrando a composição real de cada regime
- Isso resolve o problema visual da imagem onde MEI fica invisível ao lado de Simples Nacional

### 2. Tooltip customizado refinado
- Reutilizar o estilo do `StackedTooltip` existente mas melhorar com:
  - Barra de progresso colorida ao lado de cada segmento
  - Mostrar valor absoluto + percentual
  - Borda sutil e sombra consistente com os outros tooltips

### 3. Legenda customizada lateral
- Substituir a `<Legend>` padrão do recharts por uma legenda customizada no mesmo estilo do `renderLegend` dos donuts (com bolinhas coloridas + nome)
- Posicionada abaixo do gráfico em layout clean

### 4. Detalhes visuais
- `CartesianGrid` mais sutil (opacity 0.3, apenas horizontal)
- Bordas arredondadas em todas as barras (`radius={[0, 4, 4, 0]}` para horizontal)
- Gradiente sutil nas barras usando `<defs><linearGradient>` para cada cor
- Animação staggered: `animationBegin={i * 150}` para cada `<Bar>`
- Mostrar valor absoluto dentro da barra quando há espaço suficiente (label customizado)

### 5. Layout do card
- Flex row: gráfico à esquerda (~70%), legenda customizada à direita (~30%)
- Subtítulo discreto: "Distribuição percentual de segmentos por regime"
- Mesmo hover shadow transition dos cards vizinhos

## Detalhes técnicos
- Apenas `src/pages/Clients.tsx` é modificado
- Sem dependências novas
- Reutiliza `CHART_COLORS`, `segmentList`, `stackedData` já computados

