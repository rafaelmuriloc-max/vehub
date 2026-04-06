

# Listar notas ao clicar nos cards de retenção

## O que será feito
Ao clicar em qualquer card de retenção (Total Retido ou imposto individual), abrir um Dialog/modal listando as notas fiscais que contribuíram para aquele valor, com o valor retido de cada nota.

## Alterações em `src/components/invoices/NfseTab.tsx`

### 1. Estado para controlar o modal
Adicionar estado `retentionDetail` com tipo `{ type: 'prestado' | 'tomado', taxKey: keyof Retentions | 'total' } | null`.

### 2. Lógica de filtragem das notas
Quando o modal abre, filtrar as notas (`prestadosInvoices` ou `tomadosInvoices` conforme `type`) onde `parseRetentions(inv)[taxKey] > 0`. Calcular o valor retido individual de cada nota para exibição.

### 3. Modal com tabela de notas
- Usar componente `Dialog` existente
- Header: nome do imposto selecionado + total
- Tabela com colunas: Numero, Cliente, Data Emissao, Valor Bruto, Valor Retido (do imposto clicado)
- Ordenar por valor retido decrescente

### 4. Tornar cards clicáveis
- Adicionar `cursor-pointer hover:shadow-md transition-shadow` aos cards de retenção (tanto Prestados quanto Tomados)
- onClick: `setRetentionDetail({ type, taxKey })`
- Aplicar ao card "Total Retido" e aos 7 cards individuais de ambas as seções

### Estrutura do Dialog
```text
┌─────────────────────────────────────────────┐
│  ISS Retido - Serviços Tomados              │
│  Total: R$ 1.234,56                         │
├─────────────────────────────────────────────┤
│  Número | Cliente | Data | Bruto | Retido   │
│  001    | Acme    | ...  | 5000  | 500      │
│  002    | Beta    | ...  | 3000  | 300      │
└─────────────────────────────────────────────┘
```

## Arquivo
- `src/components/invoices/NfseTab.tsx` — ~60 linhas adicionadas

