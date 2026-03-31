

# Enviar procuração do cliente no Integra Contador

## Problema
Atualmente, o `autorPedidoDados` é configurado como o CNPJ do escritório (igual ao `contratante`), então a condição `autorPedidoCpfCnpj !== contratanteCnpj` nunca é verdadeira e o fluxo de procuração nunca é acionado.

## Solução
Alterar o `autorPedidoDados` para usar o CNPJ do **cliente** (contribuinte), fazendo com que o fluxo de procuração seja acionado automaticamente em todas as chamadas.

## Mudança em `supabase/functions/integra-contador/index.ts`

### Linhas 287-289 — trocar autorPedidoDados
De:
```ts
const autorPedidoCpfCnpj = contratanteCnpj;
const autorPedidoTipo = 2;
```
Para:
```ts
const clientCnpjClean = client.document.replace(/\D/g, "");
const autorPedidoCpfCnpj = clientCnpjClean;
const autorPedidoTipo = clientCnpjClean.length <= 11 ? 1 : 2;
```

Isso faz com que `autorPedidoCpfCnpj !== contratanteCnpj` seja verdadeiro (a menos que o cliente seja o próprio escritório), acionando o fluxo de procuração existente que já gera o XML assinado e obtém o `autenticar_procurador_token`.

### Remover variável duplicada (linha 425)
A variável `clientCnpj` já será criada antes, então reutilizar `clientCnpjClean` no `requestBody`.

## Arquivo modificado
- `supabase/functions/integra-contador/index.ts`

