

# Exibir nome e quantidade de obrigações dentro de cada dia do calendário

## O que será feito
Alterar as células do calendário para mostrar o nome de cada obrigação agrupada com sua quantidade e dot colorido por tipo (alerta/meta/vencimento), em vez de apenas dots genéricos com contagem total.

## Alterações em `src/pages/CalendarView.tsx`

### 1. Nova função helper `getDayObligationSummary(day)`
Agrupa os eventos do dia por `obligationName` + `type`, retornando uma lista com `{ name, type, count }`. Isso permite renderizar cada obrigação individualmente na célula.

### 2. Atualizar renderização da célula do dia (linhas ~562-607)
Substituir os dots genéricos por uma lista compacta de obrigações:
- Cada linha mostra: dot colorido + nome truncado + contagem
- Limitar a ~3 itens visíveis por célula com indicador "+N mais" se houver mais
- Fonte pequena (`text-[10px]`) para caber no espaço
- Nome truncado com `truncate` para não quebrar o layout

### Layout da célula
```text
┌─────────────┐
│ 5            │
│ ● FGTS  64  │
│ ● INSS 116  │
│ +2 mais      │
└─────────────┘
```

### 3. Ajustar altura mínima das células
Aumentar `min-h-[80px]` para `min-h-[100px]` para acomodar os nomes.

## Arquivo
- `src/pages/CalendarView.tsx`

