

# Adicionar campo "Competência" no cadastro de obrigações mensais

## Contexto
Obrigações como Folha de Pagamento vencem em um mês mas se referem à competência do mês anterior. Atualmente, o sistema usa o `reference_month` da instância diretamente como competência nas mensagens (e-mail/WhatsApp), o que gera informação incorreta.

## Alterações

### 1. Migração SQL — adicionar coluna `competence_rule` na tabela `obligations`
```sql
ALTER TABLE obligations ADD COLUMN competence_rule text NOT NULL DEFAULT 'current';
```
Valores: `current` (mês atual) ou `previous` (mês anterior).

### 2. `src/pages/Obligations.tsx` — campo condicional no formulário
- Adicionar `competence_rule` ao `obligationForm` state (default `'current'`)
- Quando `recurrence === 'mensal'`, exibir um `Select` com:
  - "Mês atual" (`current`)
  - "Mês anterior" (`previous`)
- Incluir `competence_rule` no payload de `saveObligation`
- Carregar o valor ao editar (`openEditObligation`)
- Atualizar o tipo `Obligation` para incluir `competence_rule`

### 3. `src/lib/sendActivityEmail.ts` — ajustar cálculo da competência
- Buscar `competence_rule` da obrigação (já tem o `obligation_id` via instância)
- Se `competence_rule === 'previous'`, subtrair 1 mês do `refDate` antes de formatar `[Competencia]`

### 4. `src/lib/sendActivityWhatsApp.ts` — mesmo ajuste
- Buscar `competence_rule` e aplicar a mesma lógica de subtração de mês

### 5. `src/components/ClientObligationsTab.tsx` — ajustar variável no dialog de e-mail
- Ao montar `[Competencia]` para preview, considerar `competence_rule` da obrigação

### 6. Atualizar `src/integrations/supabase/types.ts`
- Adicionar `competence_rule` ao tipo da tabela `obligations`

## Arquivos
- Migração SQL (nova)
- `src/pages/Obligations.tsx`
- `src/lib/sendActivityEmail.ts`
- `src/lib/sendActivityWhatsApp.ts`
- `src/components/ClientObligationsTab.tsx`
- `src/integrations/supabase/types.ts`

