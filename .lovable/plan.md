

# Corrigir exibição de obrigações no calendário (limite de 1000 linhas)

## Problema
A tabela `obligation_instances` tem **1955 registros**, mas o Supabase retorna no máximo **1000 por query** (limite padrão). O calendário carrega apenas as primeiras 1000 instâncias, e as do FGTS ficam de fora.

## Solução
Filtrar as instâncias no lado do servidor para trazer apenas as do mês visualizado, em vez de carregar todas. Isso resolve o limite e melhora a performance.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Filtrar `obligation_instances` pelo mês atual
Na função `loadData`, adicionar filtro por `reference_month` baseado no mês/ano exibido no calendário:

```typescript
// Antes (sem filtro, bate no limite de 1000):
supabase.from('obligation_instances').select('...')

// Depois (filtra pelo mês visualizado):
const monthStart = `${year}-${String(month+1).padStart(2,'0')}-01`;
const monthEnd = `${year}-${String(month+2 > 12 ? 1 : month+2).padStart(2,'0')}-01`;
supabase.from('obligation_instances')
  .select('...')
  .gte('reference_month', monthStart)
  .lt('reference_month', monthEnd)
```

### 2. Adicionar `currentDate` como dependência do `loadData`
O `useCallback` do `loadData` precisa depender de `currentDate` (ou `year`/`month`) para recarregar quando o usuário muda de mês.

### 3. Lógica de eventos (`events` memo)
Mantém como está — já filtra por mês ao gerar as datas dos dias. Com o filtro no servidor, os dados já vêm corretos.

## Arquivo
- `src/pages/CalendarView.tsx`

