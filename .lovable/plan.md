

# Adicionar tabela de quantidades Regime × Segmento

## Objetivo
Mostrar uma tabela abaixo do gráfico de barras com os valores absolutos do cruzamento entre regime tributário e segmento, complementando a visualização percentual do gráfico.

## Mudanças em `src/pages/Clients.tsx`

### 1. Adicionar tabela dentro do card existente do gráfico (após o `ResponsiveContainer`)
- Usar os componentes `Table, TableHeader, TableBody, TableRow, TableHead, TableCell` já existentes no projeto
- Importar de `@/components/ui/table`

### 2. Estrutura da tabela
- **Colunas**: Regime Tributário | cada segmento da `segmentList` | Total
- **Linhas**: uma por regime (dados de `rawStackedData`)
- **Última linha**: totais por segmento (soma de cada coluna)
- Células coloridas com os dots do segmento para referência visual
- Valores alinhados à direita, regime à esquerda

### 3. Posicionamento
- Abaixo do gráfico de barras, dentro do mesmo card `Regime Tributário × Segmento`
- Separador visual (`<Separator />` ou margin-top) entre gráfico e tabela
- Subtítulo discreto: "Quantidades absolutas"

### Detalhes técnicos
- Apenas `src/pages/Clients.tsx` é modificado
- Reutiliza `rawStackedData`, `segmentList`, `CHART_COLORS` já computados
- Adiciona import de `Table` components (já existem no projeto)

