

# Separar cards de resumo por Prestados e Tomados

## O que será feito
Substituir os 3 cards de resumo atuais (Total de Notas, Valor Bruto Total, Total de Impostos) por uma versão que mostra os valores separados por tipo: Prestados e Tomados, semelhante ao layout da imagem de referência.

## Alterações em `src/components/invoices/NfseTab.tsx`

### 1. Calcular totais separados
Após `baseFiltered`, calcular:
- `prestadosInvoices` = notas com `getInvoiceType === 'prestado'` (de `baseFiltered`)
- `tomadosInvoices` já existe
- Totais de quantidade, valor bruto e impostos para cada grupo

### 2. Redesenhar os cards de resumo (linhas 458-478)
Substituir o grid atual por duas seções:

**Serviços Prestados** (azul):
- 3 cards: Total de Notas, Valor Bruto Total, Total de Impostos — com valores dos prestados

**Serviços Tomados** (laranja):
- 3 cards: Total de Notas, Valor Bruto Total, Total de Impostos — com valores dos tomados

Cada seção terá um título/label com cor diferenciada (azul para prestados, laranja para tomados) e os cards organizados em grid `grid-cols-1 md:grid-cols-3`.

Quando o filtro de tipo estiver ativo, ambas as seções ainda aparecem mas refletem os dados filtrados por cliente/data (usando `baseFiltered`).

### 3. Manter cards de retenção
Os cards de impostos retidos (já existentes) continuam abaixo, sem alteração.

## Arquivo
- `src/components/invoices/NfseTab.tsx` — ~30 linhas alteradas/adicionadas

