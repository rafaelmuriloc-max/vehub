

# Cards de impostos retidos em notas de serviços tomados

## O que será feito

Adicionar uma seção de cards resumo que aparece quando o filtro de tipo está em "Tomados" (ou "Todos"), mostrando os impostos retidos nas NFS-e tomadas. Os valores serão extraídos do XML armazenado em `raw_data.xml`.

## Dados disponíveis no XML

A estrutura XML das NFS-e contém:
- `tpRetISSQN`: 1 = sem retenção ISS, 2 = com retenção ISS
- `vTotalRet`: valor total retido
- `vRetIRRF`: IRRF retido (tribFed)
- `vRetPIS`, `vRetCOFINS`, `vRetCSLL`, `vRetINSS`, `vRetCP`: demais retenções federais

## Alterações em `src/components/invoices/NfseTab.tsx`

### 1. Expandir o tipo `Invoice`
- Adicionar `raw_data: { xml?: string } | null` ao tipo

### 2. Função `parseRetentions(inv: Invoice)`
Extrair do XML via regex:
- `vTotalRet`, `tpRetISSQN`, `vRetIRRF`, `vRetPIS`, `vRetCOFINS`, `vRetCSLL`, `vRetINSS`, `vRetCP`
- Calcular ISS retido: se `tpRetISSQN === '2'`, o ISS retido = `vTotalRet` menos as retenções federais (ou `vTotalRet` se não houver federais)

### 3. Calcular totais de retenção
- Filtrar apenas notas tomadas (`getInvoiceType === 'tomado'`)
- Somar cada tipo de retenção: ISS, IRRF, PIS, COFINS, CSLL, INSS, CP
- Total geral retido

### 4. Cards de retenção (nova seção)
- Exibidos abaixo dos cards de resumo existentes, apenas quando há notas tomadas nos filtros
- Grid responsivo com cards para cada imposto que tenha valor > 0
- Card principal "Total Retido" em destaque
- Cards individuais: ISS, IRRF, PIS, COFINS, CSLL, INSS, CP — apenas os que tiverem valor
- Cores diferenciadas (ex: vermelho/laranja para retenções)

## Arquivo
- `src/components/invoices/NfseTab.tsx` — ~50 linhas adicionadas

