

# Obrigações anuais: mês de referência e competência (ano anterior/atual)

## Problema
Obrigações com periodicidade "anual" não permitem escolher em qual mês elas ocorrem, nem se a competência se refere ao ano atual ou ao ano anterior (ex: RAIS, DIRF referem-se ao ano anterior).

## Solução

### 1. Migração: adicionar coluna `annual_month` na tabela `obligations`
```sql
ALTER TABLE public.obligations ADD COLUMN annual_month integer;
```
Armazena o mês (1-12) em que a obrigação anual deve ser gerada. A coluna `competence_rule` já existe e será reutilizada com valores `current` (ano atual) e `previous` (ano anterior).

### 2. Atualizar `src/pages/Obligations.tsx`

**Form state**: Adicionar `annual_month: ''` ao `obligationForm`.

**Payload de save** (linha 179): Mudar a lógica para salvar `competence_rule` também quando `recurrence === 'anual'`, e salvar `annual_month`:
```typescript
competence_rule: ['mensal', 'anual'].includes(obligationForm.recurrence) 
  ? obligationForm.competence_rule : 'current',
annual_month: obligationForm.recurrence === 'anual' && obligationForm.annual_month 
  ? Number(obligationForm.annual_month) : null,
```

**UI do formulário** (após linha 531): Mostrar campos extras quando `recurrence === 'anual'`:
- Select de "Mês de referência" com os 12 meses
- Select de "Competência" com opções "Ano atual" e "Ano anterior"

**Geração de instâncias** (função `generateObligationInstances`): Para obrigações anuais, gerar apenas 1 instância no mês selecionado (em vez de iterar de startMonth a 12).

**openEditObligation**: Carregar `annual_month` do objeto da obrigação.

### 3. Atualizar geração no `ClientObligationsTab.tsx` e `CalendarView.tsx`
Ajustar a lógica de geração/exibição para respeitar `annual_month` em obrigações anuais (gerar apenas no mês correto).

## Arquivos
- Migration: `ALTER TABLE obligations ADD COLUMN annual_month integer`
- `src/pages/Obligations.tsx` (~30 linhas alteradas)
- `src/components/ClientObligationsTab.tsx` (ajuste menor na geração)

