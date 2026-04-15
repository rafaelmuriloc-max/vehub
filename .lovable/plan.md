

# Corrigir detecção de status fiscal -- campo `dados` sendo descartado

## Problema

O campo `dados` da resposta SERPRO é uma string JSON longa (>500 caracteres) que contém as informações fiscais reais (pendências, débitos, etc.). A função `stripBinaryFields` remove qualquer string com mais de 500 caracteres, então o conteúdo fiscal inteiro está sendo descartado antes da busca por keywords. Resultado: a busca não encontra nenhum indicador negativo e marca tudo como "regular".

## Solução

Modificar a lógica para buscar keywords no `parsedDados` (que já foi parseado de string para objeto) em vez de no `responseData` cru. Isso permite que o `stripBinaryFields` percorra os campos internos do objeto parsed, removendo apenas o PDF base64 e preservando os textos curtos com as informações fiscais.

### Mudança em `SituacaoFiscalTab.tsx` (linhas 174-175)

Substituir:
```typescript
const responseStr = JSON.stringify(stripBinaryFields(responseData) || '').toLowerCase();
```

Por:
```typescript
// Search in parsed dados (where fiscal info lives) AND in responseData metadata
const strippedDados = stripBinaryFields(parsedDados);
const strippedResponse = stripBinaryFields(responseData);
const responseStr = (JSON.stringify(strippedDados || '') + JSON.stringify(strippedResponse || '')).toLowerCase();
```

Isso garante que:
1. O `parsedDados` (objeto com campos fiscais) é percorrido campo a campo -- strings curtas com "débito", "pendência" etc. são preservadas
2. O PDF base64 continua sendo removido (é uma string >500 chars ou campo chamado "pdf")
3. Os metadados do `responseData` (mensagens, status) também são incluídos na busca

| Arquivo | Mudança |
|---------|--------|
| `src/components/integra-contador/SituacaoFiscalTab.tsx` | Buscar keywords no `parsedDados` em vez de apenas no `responseData` cru |

