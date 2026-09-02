# Colunas Destinatário / Emitente na lista de NFS-e

## Objetivo
Na lista de Notas Fiscais de Serviço (NFS-e), adicionar uma coluna contextual por aba:
- Aba **Prestados**: coluna **Destinatário** (tomador do serviço).
- Aba **Tomados**: coluna **Emitente** (prestador do serviço).

## O que será alterado
Arquivo: `src/components/invoices/NfseTab.tsx`

## Como
1. Carregar um mapa de CNPJ → nome a partir de:
   - `public.service_takers` (colunas `document`, `company_name`).
   - `public.clients` (colunas `document`, `company_name`), para cobrir clientes da própria base.
2. Criar helper `getCounterpartyName(invoice, type)`:
   - Prestado: resolve nome a partir de `taker_cnpj`.
   - Tomado: resolve nome a partir de `issuer_cnpj`.
   - Se não houver nome, exibe o CNPJ formatado (`XX.XXX.XXX/XXXX-XX`) ou `—`.
3. Ajustar o cabeçalho da tabela para mostrar:
   - `"Destinatário"` quando `listTab === 'prestados'`.
   - `"Emitente"` quando `listTab === 'tomados'`.
4. Inserir a célula correspondente no corpo da tabela, posicionada após a coluna "Número".
5. Preservar comportamentos existentes: filtros, paginação, exportação de XMLs, resumo de retenções e responsividade.

## Validação
- Typecheck e build devem passar.
- Visualmente, a coluna deve alternar o título e o conteúdo conforme a aba ativa.
