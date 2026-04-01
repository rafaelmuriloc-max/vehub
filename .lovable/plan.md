

# Criar abas NFS-e, NF-e e NFC-e na página de Notas Fiscais

## Visão geral
Reestruturar a página de Notas Fiscais em 3 abas. O conteúdo atual (543 linhas) será movido integralmente para `NfseTab.tsx`. As abas NF-e e NFC-e serão criadas como novos componentes. Uma nova Edge Function e tabela serão criadas para a consulta de NF-e via Web Service SEF-SC.

## Alterações

### 1. `src/pages/Invoices.tsx` — Simplificar para container com Tabs
- Remover todo o conteúdo atual
- Renderizar `Tabs` com 3 abas: NFS-e, NF-e, NFC-e
- Importar os 3 componentes de aba

### 2. `src/components/invoices/NfseTab.tsx` — Conteúdo atual
- Mover 100% do código existente de `Invoices.tsx` para cá
- Sem alteração de lógica, apenas transformar de page em componente

### 3. `src/components/invoices/NfeTab.tsx` — Nova aba NF-e
- Interface similar à NFS-e: seleção de cliente, botão consultar, tabela de resultados
- Filtros: cliente, período
- Tabela: número, chave de acesso, emitente, destinatário, data emissão, valor, status
- Download de XML individual
- Chama Edge Function `nfe-query`

### 4. `src/components/invoices/NfceTab.tsx` — Placeholder
- Mensagem "Em breve" com ícone

### 5. Migração SQL — tabela `nfe_invoices` + coluna `last_nfe_nsu`
- `nfe_invoices`: id, client_id (FK), access_key (unique), invoice_number, issue_date, emitter_cnpj, emitter_name, recipient_cnpj, recipient_name, total_value, status, nsu, xml_url, raw_xml, created_at
- RLS para authenticated
- Adicionar `last_nfe_nsu` em `clients`

### 6. Edge Function `supabase/functions/nfe-query/index.ts`
- Recebe `{ client_id }`
- Carrega certificado A1 do cliente
- Monta SOAP XML `distNFeSC v2.00` com `ultNuNSU` do `clients.last_nfe_nsu`
- POST mTLS para `https://satnfe.sef.sc.gov.br/ws/distribuicao/nfedownloadV2.asmx`
- Descompacta `loteDistComp` (base64 → gzip → XML)
- Parseia até 50 docs por lote, extrai dados da NF-e
- Upsert em `nfe_invoices`, atualiza `clients.last_nfe_nsu`
- Loop se cStat=118 (mais docs disponíveis)

## Arquivos
- `src/pages/Invoices.tsx` — reescrito (container com Tabs)
- `src/components/invoices/NfseTab.tsx` — criado (conteúdo atual)
- `src/components/invoices/NfeTab.tsx` — criado
- `src/components/invoices/NfceTab.tsx` — criado
- `supabase/functions/nfe-query/index.ts` — criado
- Migração SQL — criada

