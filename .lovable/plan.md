

# Filtrar lista mensal por data Meta e trocar coluna Tipo por Data Meta

## Objetivo
Na lista "Todas as obrigações do mês", mostrar apenas eventos do tipo `target` (Meta) e substituir a coluna "Tipo" por "Data Meta" mostrando a data formatada.

## Mudanças

### Arquivo: `src/pages/CalendarView.tsx`

1. **Filtrar `monthEvents`** para incluir apenas `type === 'target'`:
   - Linha ~163: adicionar `.filter(e => e.type === 'target')` ao useMemo

2. **Substituir coluna "Tipo" por "Data Meta"** na tabela do mês:
   - Linha 381: trocar `<TableHead>Tipo</TableHead>` por `<TableHead>Data Meta</TableHead>`
   - Linhas 394-400: trocar o conteúdo da célula pelo dia formatado (ex: `15/03/2026`), mantendo o badge "Concluída" quando aplicável

