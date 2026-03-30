

# Adicionar campo "Execução Automática" nas atividades de obrigação

## Objetivo
Adicionar um campo booleano na atividade que define se ela inicia automaticamente após a conclusão da atividade anterior (auto) ou se precisa ser marcada manualmente.

## Mudanças

### 1. Migração SQL
Adicionar coluna `auto_start` (boolean, default false) na tabela `obligation_activities`:
```sql
ALTER TABLE public.obligation_activities ADD COLUMN auto_start boolean NOT NULL DEFAULT false;
```

### 2. `src/pages/Obligations.tsx`
- Adicionar `auto_start` ao type `Activity` e ao `activityForm` state
- No formulário de atividade (dialog ~linha 301-335), adicionar um Switch/Checkbox com label "Execução automática" e descrição "Inicia automaticamente após a atividade anterior ser concluída"
- Incluir `auto_start` no payload de `saveActivity`
- Na tabela de atividades, mostrar badge "Auto" quando `auto_start === true`
- Importar `Switch` de `@/components/ui/switch`

### 3. Lógica de auto-completar em `ClientObligationsTab.tsx` e `CalendarView.tsx`
- Após `toggleCompletion` marcar uma atividade como concluída, verificar se a próxima atividade (por `order`) tem `auto_start === true`
- Se sim, marcar automaticamente como concluída também (em cadeia)

## Detalhes técnicos
- Arquivos modificados: `src/pages/Obligations.tsx`, `src/components/ClientObligationsTab.tsx`, `src/pages/CalendarView.tsx`
- Nova migração para adicionar coluna
- Sem nova dependência

