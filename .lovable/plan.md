# Mostrar apenas nome do Destinatário / Emitente na lista de NFS-e

## Objetivo
Na coluna contextual da lista de NFS-e, exibir **somente o nome** do Destinatário (aba Prestados) ou Emitente (aba Tomados). Quando o nome não for encontrado na base, deve aparecer `—`.

## O que será alterado
Arquivo: `src/components/invoices/NfseTab.tsx`

## Como
1. Ajustar a função `getCounterpartyName` para retornar apenas o nome resolvido no mapa de CNPJ → nome.
2. Caso não exista nome cadastrado para o CNPJ, retornar `—`.
3. Manter a formatação de CNPJ (`formatCnpj`) disponível caso seja necessária futuramente, mas não usá-la como fallback de exibição.

## Validação
- Typecheck e build devem passar.
- A coluna deve exibir apenas nomes; CNPJs não devem aparecer na célula.
