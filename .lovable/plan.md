

# Corrigir geração de REINF para notas de serviços prestados (emitidos)

## Problema

A obrigação REINF está configurada com `retention_tax_type = 'inss'` e `assignment_mode = 'retention_auto'`. Porém, a Edge Function `retention-obligation-generate` só analisa **notas tomadas** (onde o cliente NÃO é o emissor, linha 80: `if (issuerCnpj === clientCnpj) continue`).

Para a REINF, o critério correto é o oposto: notas de **serviços prestados** (emitidos), onde o cliente **É** o emissor. Existem 5 clientes com notas emitidas em março.

## Solução

Modificar a Edge Function `retention-obligation-generate` para suportar dois fluxos de detecção:

1. **Obrigações de retenção "tomadas"** (comportamento atual): ISS, IRRF, PIS, COFINS, CSLL, CP — notas onde o cliente é o tomador
2. **Obrigações de retenção "prestadas"** (novo): INSS/REINF — notas onde o cliente é o emissor

### Mudanças na Edge Function

Na etapa 5, além do loop atual que filtra tomadas (`issuerCnpj !== clientCnpj`), adicionar um segundo loop que filtra **prestadas** (`issuerCnpj === clientCnpj`) e marca o tipo `inss_prestado` ou simplesmente `inss`.

Alternativa mais limpa: adicionar um campo na tabela `obligations` para indicar se a retenção é sobre notas tomadas ou prestadas, mas como só a REINF precisa disso, podemos tratar diretamente no código:

- Se `retention_tax_type === 'inss'`: buscar notas **prestadas** (cliente = emissor)
- Para todos os outros tipos: buscar notas **tomadas** (comportamento atual)

### Código

No loop de invoices (linhas 72-93), ao invés de pular quando `issuerCnpj === clientCnpj`, criar dois Maps:
- `clientRetentionsTomadas` — notas tomadas (atual)
- `clientPrestadas` — Set de client_ids que emitiram notas no período

Na etapa 6 (linha 99+), para obrigações com `retention_tax_type === 'inss'`, usar `clientPrestadas` em vez de `clientRetentions`.

## Arquivo

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/retention-obligation-generate/index.ts` | ~15 linhas — separar fluxo prestadas vs tomadas, usar prestadas para INSS/REINF |

## Resultado esperado

Ao executar a Edge Function em abril, ela detectará os 5 clientes que emitiram notas em março e gerará instâncias da REINF com vencimento dia 15/04 (ou dia útil anterior).

