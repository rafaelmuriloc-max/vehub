
# Corrigir filtro de tipo de folha na segmentação

## Problema
O banco de dados armazena `payroll_type` como `'normal'` e `'pro_labore'` (minúsculo), mas o filtro compara com `'Normal'` e `'Pró-labore'` (capitalizado). Por isso nenhuma empresa é encontrada.

Dados reais no banco:
- `normal`: 47 empresas
- `pro_labore`: 20 empresas

## Correção em `src/pages/Obligations.tsx`

Linha 107-108: Alterar as comparações para usar os valores reais do banco:

```typescript
if (filters.payroll_filter === 'normal' && c.payroll_type !== 'normal') return false;
if (filters.payroll_filter === 'pro_labore' && c.payroll_type !== 'pro_labore') return false;
```

Alternativamente, usar comparação case-insensitive para ser mais robusto.

## Arquivo
- `src/pages/Obligations.tsx` (2 linhas)
