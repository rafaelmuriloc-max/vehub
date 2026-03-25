

# Mover Data da Meta para coluna separada no card mensal

## Objetivo
Exibir a data da meta como uma coluna à esquerda do nome da obrigação, em vez de dentro do badge de tipo.

## Mudança em `src/pages/CalendarView.tsx` (linhas 497-506)

Reestruturar o layout do card para ter 3 colunas:
1. **Data da meta** (coluna fixa à esquerda) — data formatada (ex: `15/03`) em texto destaque
2. **Nome da obrigação + empresa** (coluna flexível central)
3. **Badge do tipo** (sem a data, apenas "Meta")

Estrutura:
```
[15/03] [Nome da obrigação          ] [Meta]
        [🏢 Nome da empresa         ]
```

### Detalhes
- Linha 497-506: trocar o `flex items-start justify-between` por um layout com 3 seções
- Data formatada: `ev.date.split('-').reverse().slice(0,2).join('/')` (DD/MM)
- Remover ` · {ev.date...}` do badge (linha 505)
- Estilizar a data com `text-sm font-semibold text-primary` em um bloco fixo (`w-14 shrink-0`)

