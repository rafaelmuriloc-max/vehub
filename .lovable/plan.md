

# Filtrar NFS-e por Serviços Prestados e Tomados

## Situação atual
O backend (nfse-query) já captura **ambos** os tipos de notas — prestadas e tomadas — pois o ADN retorna todos os documentos vinculados ao CNPJ do cliente. Os campos `issuer_cnpj` e `taker_cnpj` já são preenchidos corretamente no banco. O que falta é a **distinção na interface**.

## Alterações em `src/components/invoices/NfseTab.tsx`

### 1. Novo filtro de tipo (Prestados / Tomados / Todos)
- Adicionar state `filterType: 'all' | 'prestados' | 'tomados'` (default: `'all'`)
- Adicionar um `Select` na barra de filtros com as opções: "Todos", "Serviços Prestados", "Serviços Tomados"
- Na filtragem, comparar o CNPJ do cliente selecionado com `issuer_cnpj` (prestados) ou `taker_cnpj` (tomados)

### 2. Lógica de filtragem
Para determinar se uma nota é prestada ou tomada, comparar o CNPJ do cliente (`clients.document` limpo) com o `issuer_cnpj` da nota:
- **Prestados**: `issuer_cnpj` corresponde ao CNPJ do cliente vinculado (`client_id`)
- **Tomados**: `issuer_cnpj` NÃO corresponde ao CNPJ do cliente (ou `taker_cnpj` corresponde)

### 3. Indicação visual na tabela
- Adicionar uma coluna "Tipo" com badge: `Prestado` (azul) ou `Tomado` (laranja), determinado pela comparação do CNPJ do prestador com o do cliente

### 4. Cards de resumo
- Atualizar os totais para refletir o filtro de tipo ativo

## Arquivo
- `src/components/invoices/NfseTab.tsx` — ~20 linhas adicionadas/alteradas

