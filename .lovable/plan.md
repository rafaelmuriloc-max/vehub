

# Adicionar gráfico de cruzamento Regime Tributário × Segmento

## Objetivo
Adicionar um terceiro card com gráfico de barras empilhadas (stacked bar chart) mostrando a distribuição de segmentos dentro de cada regime tributário.

## Mudanças em `src/pages/Clients.tsx`

### 1. Importar BarChart do recharts
- Adicionar `BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid` ao import de recharts

### 2. Computar dados de cruzamento
- Criar uma matriz: para cada regime tributário, contar quantos clientes existem em cada segmento
- Formato: `[{ regime: 'Simples Nacional', Comércio: 5, Serviços: 3, Indústria: 2, ... }, ...]`
- Extrair lista única de segmentos para gerar as `<Bar>` dinamicamente

### 3. Novo card abaixo dos dois existentes
- Card de largura total (`lg:col-span-2` ou fora do grid de 2 colunas)
- Título: "Regime Tributário × Segmento" com ícone
- `BarChart` com barras empilhadas:
  - Eixo X: regimes tributários
  - Cada cor representa um segmento
  - Tooltip customizado mostrando contagem e percentual
  - Legend com os segmentos
- Usa as mesmas `CHART_COLORS` já existentes
- Mesma animação e estilo visual dos donuts

### Detalhes técnicos
- Apenas `src/pages/Clients.tsx` é modificado
- Sem dependências novas (recharts já está no projeto)
- O card ficará abaixo do grid de 2 colunas dos donuts existentes

