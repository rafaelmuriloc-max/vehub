# Desabilitar busca automática do regime tributário (apenas auto-batch)

## Contexto
O `tax_regime` é definido em três locais a partir do `cnpj-lookup`:

1. **Cadastro/edição manual** (`fetchCnpjData`, `src/pages/Clients.tsx:392-404`) — usuário clica em "Buscar CNPJ". **MANTER.**
2. **Batch update automático ao abrir a página** (`useEffect`, `src/pages/Clients.tsx:429-483`) — roda sozinho uma vez por navegador e sobrescreve o regime no banco. **REMOVER.**
3. **Batch update manual** (`batchUpdateAllCnpj`, `src/pages/Clients.tsx:587-669`) — admin clica num botão. **MANTER.**

## O que será feito
Remover apenas o `useEffect` automático (item 2):

- Excluir o bloco `useEffect` que invoca `batchUpdateTaxRegimes` (linhas ~429-483) em `src/pages/Clients.tsx`.
- A chave `localStorage` `tax_regime_batch_done` deixa de ser usada — não precisa de limpeza ativa.
- `fetchCnpjData` e `batchUpdateAllCnpj` permanecem intactos, então o usuário ainda consegue puxar/atualizar o regime quando quiser.

## Arquivos alterados
- `src/pages/Clients.tsx`

## Fora de escopo
- Edge Function `cnpj-lookup`, schema do banco e demais campos auto-preenchidos (endereço, CNAE, sócios, etc.) permanecem como estão.