

# Mostrar competência ao lado do nome da obrigação no calendário

## O que será feito
Exibir a competência da obrigação ao lado do nome, separada por `|`. Exemplo: **"Folha de Pagamento Mensal | Mar/2026"**.

A competência é calculada com base na `competence_rule` da obrigação:
- `current`: competência = `reference_month` da instância
- `previous`: competência = mês anterior ao `reference_month`

## Alterações em `src/pages/CalendarView.tsx`

### 1. Adicionar `competence_rule` ao tipo `Obligation` e à query
- Tipo: `Obligation = { ..., competence_rule: string }`
- Query: adicionar `competence_rule` no select de `obligations`

### 2. Adicionar campo `competenceLabel` ao `CalendarEvent`
- Novo campo `competenceLabel: string` no tipo `CalendarEvent`
- No loop de criação dos eventos, calcular a competência:
  - Se `competence_rule = 'previous'`: subtrair 1 mês do `reference_month`
  - Se `competence_rule = 'current'`: usar o `reference_month` diretamente
  - Formatar como `"Mmm/AAAA"` (ex: `"Mar/2026"`)

### 3. Alterar a exibição do nome em todos os locais
Nos ~5 pontos onde `ev.obligationName` é renderizado (linhas ~601, ~686, ~737 e no dialog de detalhes), alterar para:
```
{ev.obligationName} | {ev.competenceLabel}
```

## Arquivos
- `src/pages/CalendarView.tsx`

