

# Corrigir vinculação de documentos com obrigações de competência anterior

## Problema
Quando um documento de competência março/2026 é importado, o sistema busca `obligation_instances` com `reference_month = 2026-03-01`. Porém, obrigações com `competence_rule = 'previous'` (ex: Folha de Pagamento) têm a instância em `reference_month = 2026-04-01` (mês de vencimento), pois a competência é o mês anterior. O documento deveria vincular à instância de abril, não de março.

## Solução
Na função `importDocument` e `relinkDocuments`, ao buscar instâncias correspondentes, consultar a `competence_rule` de cada obrigação. Para obrigações com `competence_rule = 'previous'`, buscar instâncias cujo `reference_month` é o mês seguinte ao `reference_month` do documento.

## Alterações em `src/pages/Documents.tsx`

### 1. `importDocument` (linhas ~208-250)
- Após obter `matchingActivities`, buscar as obrigações correspondentes com `competence_rule`
- Para cada obrigação, calcular o `reference_month` correto da instância:
  - Se `competence_rule = 'previous'`: buscar instância com `reference_month = refMonth + 1 mês`
  - Se `competence_rule = 'current'`: buscar instância com `reference_month = refMonth` (comportamento atual)
- Agrupar obrigações por regra e fazer queries separadas

### 2. `relinkDocuments` (linhas ~270-340)
- Mesma lógica: buscar `competence_rule` das obrigações vinculadas às atividades
- Ajustar o `reference_month` na query de instâncias conforme a regra

### Lógica de cálculo
```text
docMonth = "2026-03-01" (competência do documento)

Se competence_rule = 'current':
  instanceMonth = "2026-03-01"

Se competence_rule = 'previous':
  instanceMonth = "2026-04-01" (mês seguinte)
```

## Arquivos
- `src/pages/Documents.tsx`

