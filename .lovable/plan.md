

# Ajustar autorPedidoDados para sempre usar a própria empresa

## Situação atual
Linhas 90-93: se existe `accountant_cpf` configurado, o `autorPedidoDados` usa o CPF do contador (tipo 1). Caso contrário, usa o CNPJ do contratante.

## Mudança
Remover a lógica condicional do contador e sempre definir `autorPedidoDados` como o próprio CNPJ do contratante (tipo 2), igual ao campo `contratante`.

### Arquivo: `supabase/functions/integra-contador/index.ts`

- **Linhas 90-93**: Substituir a lógica condicional por valores fixos:
  - `autorPedidoCpfCnpj = contratanteCnpj`
  - `autorPedidoTipo = 2`
- Manter os campos de `accountant_cpf` no select (para uso futuro), mas não usá-los no body da requisição.

## Resultado
O body enviado ao SERPRO terá `contratante` e `autorPedidoDados` idênticos, ambos com o CNPJ do escritório.

