

# Plano: Corrigir consulta de notas fiscais que não retorna resultados

## Diagnóstico

Os logs mostram que a edge function `nfse-query` **busca 50 documentos** do ADN, mas **salva 0 invoices**. Duas causas raiz:

1. **Filtro por mês de referência descarta tudo**: Na linha 276, `matchesReferenceMonth` filtra apenas notas do mês consultado (ex: 2026-03). Se os 50 documentos retornados forem de meses anteriores, nenhum passa no filtro.

2. **Sem persistência de NSU**: A consulta sempre começa do NSU 0. A API ADN retorna documentos em ordem de NSU, então se existem muitos documentos antigos, os novos nunca são alcançados. Além disso, `ultNSU=null` e `maxNSU=null` indicam que a paginação não está funcionando corretamente — possivelmente o parser de resposta não está extraindo esses campos do JSON retornado.

3. **Notas de outros meses são ignoradas**: Mesmo que a API retorne notas válidas, elas são descartadas se não pertencem ao mês selecionado.

## Alterações

### 1. Edge Function `nfse-query` — Salvar todas as notas, não apenas do mês

- Remover o filtro `matchesReferenceMonth` do pipeline de parsing antes do upsert
- Salvar **todas** as notas retornadas pelo ADN (deduplicadas por `access_key`)
- Manter o filtro de mês apenas para o **retorno da resposta HTTP** (para que a UI saiba quantas do mês foram encontradas)

### 2. Edge Function `nfse-query` — Persistir último NSU consultado

- Adicionar coluna `last_nsu` na tabela `clients` (text, nullable) para armazenar o último NSU sincronizado
- Na consulta, iniciar do `last_nsu` salvo em vez de sempre partir do "0"
- Após o sync, atualizar o `last_nsu` do cliente

### 3. Edge Function `nfse-query` — Corrigir parsing de paginação

- Investigar e corrigir por que `ultNSU` e `maxNSU` retornam null quando o JSON contém 50 documentos (provavelmente o campo está com nome diferente no JSON da resposta)
- Adicionar logs mais detalhados das chaves do JSON de resposta

### 4. Migração de banco

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_nsu text DEFAULT NULL;
```

## Detalhes Técnicos

No `fetchInvoicesFromAdn`, a mudança principal:

```text
ANTES:
  xmlDocuments → parseXmlDocuments → dedupeInvoices → filter(matchesReferenceMonth) → return

DEPOIS:
  xmlDocuments → parseXmlDocuments → dedupeInvoices → return ALL
  (filtro de mês aplicado apenas no retorno HTTP, não no upsert)
```

No handler principal:

```text
ANTES:
  invoicesData (já filtrado) → upsert → return

DEPOIS:  
  allInvoices (sem filtro) → upsert ALL
  filteredInvoices = allInvoices.filter(matchesReferenceMonth) → return count no response
```

