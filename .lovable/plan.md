

# Corrigir salvamento de certificados digitais nos cadastros

## Problema
No `handleImport`, a busca do cliente usa `ilike('%${cnpj}%')` com CNPJ em dígitos puros (ex: `12345678000199`), mas o campo `document` armazena no formato `12.345.678/0001-99`. Como `12345678000199` NÃO é substring de `12.345.678/0001-99`, a query retorna vazio e o UPDATE nunca acontece.

## Solução

### Modificar `src/components/CertificateImportDialog.tsx`
Na função `handleImport` (linha ~226), substituir a busca por CNPJ formatado:

```typescript
// ANTES (não funciona):
const { data: existingClients } = await supabase
  .from('clients').select('id')
  .ilike('document', `%${entry.cnpj}%`).limit(1);

// DEPOIS (busca com CNPJ formatado):
const cnpjFormatted = entry.cnpj ? formatCnpjDisplay(entry.cnpj) : '';
const { data: existingClients } = await supabase
  .from('clients').select('id')
  .eq('document', cnpjFormatted).limit(1);
```

Usar `eq` com o CNPJ formatado (`XX.XXX.XXX/XXXX-XX`) para match exato, já que é assim que está armazenado no banco.

A mesma variável `cnpjFormatted` já é calculada na linha 222, então basta mover a query para usar ela.

