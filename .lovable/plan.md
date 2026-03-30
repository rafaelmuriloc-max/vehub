

# Melhorar aparência dos gráficos na página de Clientes

## Direção estética
Seguindo a skill de Frontend Design: tom **clean/refined** consistente com o design system existente (Navy + Orange). Donut charts com inner radius, legendas customizadas ao lado, tooltips estilizados e transições suaves.

## Mudanças em `src/pages/Clients.tsx`

### 1. Transformar PieCharts em Donut Charts
- Adicionar `innerRadius={55}` + `outerRadius={85}` para visual donut moderno
- Adicionar `paddingAngle={3}` e `cornerRadius={4}` para separação visual entre fatias
- Remover labels inline (ficam ilegíveis) e substituir por legenda customizada ao lado

### 2. Legenda customizada
- Renderizar lista de itens abaixo ou ao lado do gráfico com dot colorido + nome + contagem + percentual
- Layout: chart à esquerda (60%), legenda à direita (40%) em desktop; empilhado em mobile

### 3. Centro do donut com total
- Usar texto SVG centralizado mostrando o total de clientes dentro do donut

### 4. Tooltip customizado
- Substituir `<Tooltip />` genérico por componente estilizado com `bg-popover border shadow-lg rounded-lg` e formatação: nome, valor, percentual

### 5. Card styling
- Adicionar `shadow-sm hover:shadow-md transition-shadow` nos cards
- Título com ícone (Building2 para Regime, Briefcase para Segmento)

### 6. Paleta de cores expandida
- Adicionar mais cores para cobrir mais categorias sem repetição: usar tons intermediários do brand (navy/orange) + complementares

### 7. Animação de entrada
- `<Pie isAnimationActive animationBegin={0} animationDuration={800} animationEasing="ease-out">`

## Detalhes técnicos
- Apenas `src/pages/Clients.tsx` é modificado
- Usa recharts existente, sem dependências novas
- Importar `Building2, Briefcase` de lucide-react (já no projeto)

