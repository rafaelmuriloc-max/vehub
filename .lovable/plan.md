

# Adicionar gráficos de Regime Tributário e Segmento na página de Clientes

## Mudanças

### Modificar `src/pages/Clients.tsx`

1. **Importar recharts**: Adicionar `PieChart, Pie, Cell, ResponsiveContainer, Tooltip` de `recharts`

2. **Computar dados dos gráficos** a partir do array `clients`:
   - **Regime Tributário**: agrupar por `tax_regime` (Simples Nacional, Lucro Presumido, MEI, etc.), contar ocorrências
   - **Segmento**: agrupar por `business_classification` (Comércio, Serviço, Indústria, Misto), contar ocorrências

3. **Inserir dois cards com PieChart** logo após os KPI cards existentes (linha ~759), em um `grid lg:grid-cols-2`:
   - Card "Regime Tributário" com PieChart + labels
   - Card "Segmento" com PieChart + labels
   - Usar cores do tema (`hsl(var(--chart-1))` a `--chart-5`), mesmo padrão do Dashboard
   - Labels formatados em português (ex: `simples_nacional` → "Simples Nacional", `lucro_presumido` → "Lucro Presumido")

### Detalhes
- Segue exatamente o padrão visual do Dashboard (ResponsiveContainer height 250, Card com CardHeader/CardContent)
- Filtra entradas com valor 0 ou sem classificação (agrupadas como "Não informado")
- Não requer mudanças no banco de dados

