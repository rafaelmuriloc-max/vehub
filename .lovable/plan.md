

# Corrigir autorPedidoDados para usar o CNPJ do cliente

## Problema
O `autorPedidoDados` está usando o CNPJ do escritório (`contratanteCnpj`), mas conforme a imagem e o pedido do usuário, deve usar o CNPJ do **cliente** (contribuinte).

## Mudança

### Arquivo: `supabase/functions/integra-contador/index.ts`

- **Linha 91**: Trocar `contratanteCnpj` por `client.document.replace(/\D/g, "")` — o CNPJ do cliente
- **Linha 92**: Manter tipo 2 (CNPJ)
- **Linha 102**: Atualizar o log para refletir a mudança

O `contratante` continua sendo o escritório. O `autorPedidoDados` passa a ser o cliente consultado.

