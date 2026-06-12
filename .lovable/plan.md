## Objetivo
Expandir o quadro "Regime Tributário × Segmento" em `src/pages/Clients.tsx` para que cada segmento exiba três colunas em vez de uma:
1. **Qtd** (já existe — quantidade de clientes)
2. **Ticket Médio** (novo)
3. **MRR** (novo)

A coluna **Total** à direita também passará a mostrar Qtd, Ticket Médio e MRR consolidados do regime. A linha **Total** inferior somará/recalculará da mesma forma.

## Regras de cálculo (por célula regime × segmento)
- **Qtd**: total de clientes naquele regime + segmento (mantém comportamento atual, incluindo todos os clientes).
- **MRR**: soma de `monthly_value` apenas dos clientes **ativos** e que **não** estão marcados como `without_monthly_fee` (consistente com a regra global do projeto de excluir clientes em mensalidade-zero das estatísticas financeiras).
- **Ticket Médio**: `MRR ÷ quantidade de clientes ativos pagantes` na célula. Se 0 pagantes → exibir `R$ 0,00`.

Formatação:
- MRR e Ticket Médio em `R$ X.XXX,XX` (pt-BR, 2 casas).
- Qtd em número inteiro.

## Mudanças de UI
- Cabeçalho passa a ter sub-cabeçalhos. Estrutura sugerida usando dois `TableHeader` rows:
  ```text
  | Regime | Comércio (colspan 3)        | Indústria (colspan 3) | ... | Total (colspan 3) |
  |        | Qtd | Ticket | MRR          | Qtd | Ticket | MRR    | ... | Qtd | Ticket | MRR |
  ```
- Bolinha colorida do segmento permanece no cabeçalho do grupo.
- Linhas de dados: para cada segmento, 3 `<TableCell>` (Qtd, Ticket, MRR), todos `text-right text-xs tabular-nums`. MRR em `font-medium` para destaque.
- Linha Total inferior: Qtd somando os clientes do segmento, MRR somando todos os MRR do segmento e Ticket Médio = MRR_total_segmento ÷ pagantes_ativos_segmento.
- Subtítulo do card muda de "Quantidades absolutas" para "Quantidade, ticket médio e MRR por segmento".
- Adicionar `overflow-x-auto` ao container (já existe `overflow-auto`) e largura mínima na tabela para não espremer demais em telas estreitas.

## Dados a calcular
Substituir o `crossData` atual por uma estrutura mais rica calculada uma única vez no mesmo bloco IIFE (linhas ~1196-1210):

```ts
type Cell = { count: number; mrr: number; paying: number };
const crossData: Record<string, Record<string, Cell>> = {};
clients.forEach(c => {
  const regime = taxRegimeLabels[c.tax_regime || ''] || c.tax_regime || 'Não informado';
  const seg = c.business_classification || 'Não informado';
  allSegments.add(seg);
  if (!crossData[regime]) crossData[regime] = {};
  const cell = crossData[regime][seg] ||= { count: 0, mrr: 0, paying: 0 };
  cell.count += 1;
  if (c.status === 'active' && !(c as any).without_monthly_fee) {
    cell.mrr += Number(c.monthly_value || 0);
    cell.paying += 1;
  }
});
```
`rawStackedData` continua existindo para o gráfico (com `count` por segmento + `total`); apenas a tabela passa a usar `crossData` diretamente para ler Qtd/MRR/Ticket por célula.

## Escopo / fora de escopo
- **Apenas** o quadro "Regime Tributário × Segmento" muda. Gráfico empilhado, demais KPIs e cartões permanecem inalterados.
- Sem mudanças de banco de dados, edge functions ou cálculo de MRR global da página.
