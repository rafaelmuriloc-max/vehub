

# Adicionar campo "É Imposto?" com esfera tributária no cadastro de obrigações

## O que será feito
Adicionar um campo booleano "É Imposto?" no formulário de obrigações. Quando ativado, exibe um select para escolher a esfera: Federal, Estadual ou Municipal.

## Alterações

### 1. Migration — adicionar colunas na tabela `obligations`
```sql
ALTER TABLE obligations ADD COLUMN is_tax boolean NOT NULL DEFAULT false;
ALTER TABLE obligations ADD COLUMN tax_sphere text; -- 'federal', 'estadual', 'municipal'
```

### 2. `src/pages/Obligations.tsx`
- Adicionar `is_tax: false` e `tax_sphere: ''` ao `obligationForm`
- No `openEditObligation`, carregar `o.is_tax` e `o.tax_sphere`
- No `saveObligation`, incluir `is_tax` e `tax_sphere` (null se não for imposto) no payload
- No dialog do formulário (após competência, antes dos dias), adicionar:
  - Switch/Checkbox "É Imposto?" controlando `is_tax`
  - Quando `is_tax === true`, exibir Select com opções Federal/Estadual/Municipal
- Opcionalmente exibir badge "Imposto - Federal" nos cards de obrigação

### 3. `src/integrations/supabase/types.ts`
- Adicionar `is_tax` e `tax_sphere` aos tipos Row/Insert/Update da tabela `obligations`

## Arquivos
- Migration SQL (nova)
- `src/pages/Obligations.tsx`
- `src/integrations/supabase/types.ts`

