# Aproximar a frase do cabeçalho dos cards do Calendário

## Objetivo
Deixar a frase do cabeçalho ("Aqui está o panorama das suas obrigações e prazos.") mais próxima dos cards de KPI logo abaixo, conforme a referência enviada.

## Alterações previstas

### `src/pages/CalendarView.tsx`
1. **Reduzir o espaçamento geral da seção superior**
   - Diminuir o `space-y-3` da `<section>` que envolve a barra superior, saudação, botões mobile e cards de KPI para `space-y-2`.

2. **Reduzir o espaçamento interno da linha de saudação**
   - Diminuir o `gap-3` da linha que contém a data, o título e a frase para `gap-2`, reduzindo a distância vertical quando o conteúdo se empilha.

3. **Aproximar os cards da frase**
   - Adicionar `mt-1` no container da grade de KPIs (o grid com `xl:grid-cols-3`) para que os cards fiquem ainda mais colados com a frase, sem afetar os demais elementos.

## Critérios de aceitação
- A frase "Aqui está o panorama das suas obrigações e prazos." fica visualmente encostada nos cards de KPI abaixo.
- O espaçamento entre a barra superior e o restante da página não fica exageradamente grande.
- O build/typecheck continua passando.
