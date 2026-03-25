

# Converter lista mensal para cards (igual à lista do dia)

## Objetivo
Substituir a tabela da lista mensal por cards empilhados idênticos aos da lista do dia selecionado.

## Mudança em `src/pages/CalendarView.tsx`

### Substituir a `<Table>` (linhas 483-529) por cards no mesmo formato da lista do dia (linhas 415-454)

Cada card terá:
- Nome da obrigação + badge do tipo (Meta, com cor laranja)
- Nome da empresa com ícone Building2
- Badge do departamento + contagem de atividades
- Barra de progresso
- Fundo verde se concluída
- Data da meta exibida junto ao badge de tipo (ex: `15/03/2026`)
- Click abre o dialog de detalhes

Layout idêntico ao `paginatedDayEvents.map(...)`, com a adição da data da meta como informação extra.

