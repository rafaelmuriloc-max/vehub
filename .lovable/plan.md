

# Separar retenções entre Prestados e Tomados

## O que será feito
Mover os cards de impostos retidos para ficarem logo abaixo dos cards totais de cada tipo (Prestados e Tomados), calculando retenções independentemente para cada grupo.

## Alterações em `src/components/invoices/NfseTab.tsx`

### 1. Calcular retenções para Prestados
Adicionar cálculo de `prestadosRetentionTotals` usando `parseRetentions` sobre `prestadosInvoices`, da mesma forma que já é feito para `tomadosInvoices` (linhas 386-401).

### 2. Reorganizar o layout

**Seção Serviços Prestados** (linhas 464-490):
- Manter os 3 cards totais (azul)
- Adicionar logo abaixo os cards de retenção dos prestados (tema azul), com a mesma estrutura visual dos atuais mas usando `prestadosRetentionTotals`
- Exibir quando houver retenções ou quando um cliente estiver selecionado

**Seção Serviços Tomados** (linhas 492-518):
- Manter os 3 cards totais (laranja)
- Mover os cards de retenção atuais (linhas 520-589) para dentro desta seção, logo abaixo dos totais
- Manter tema laranja

### 3. Remover seção separada de retenções
Remover o bloco atual de "Impostos Retidos (Serviços Tomados)" (linhas 520-589) que hoje fica isolado após ambas as seções.

### Estrutura final
```text
Serviços Prestados (azul)
├── Cards: Total Notas | Valor Bruto | Impostos
└── Retenções: Total Retido | ISS | IRRF | PIS | COFINS | CSLL | INSS | CP

Serviços Tomados (laranja)
├── Cards: Total Notas | Valor Bruto | Impostos
└── Retenções: Total Retido | ISS | IRRF | PIS | COFINS | CSLL | INSS | CP
```

## Arquivo
- `src/components/invoices/NfseTab.tsx` — ~40 linhas alteradas/adicionadas

