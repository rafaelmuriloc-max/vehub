# Cronômetro visível nos cards da lista de obrigações

## O que vai mudar

- Cada card de obrigação na página Calendário (abas do dia e do mês: Pendentes, Atrasadas, Concluídas, Entregues fora do prazo) passa a mostrar o botão **iniciar/parar** e o **tempo total registrado** daquela obrigação, direto no card — sem precisar abrir o diálogo de detalhes.
- O comportamento é o mesmo já existente: iniciar pausa qualquer outro cronômetro seu, o tempo em execução aparece em vermelho atualizando sozinho, e tudo que é registrado entra no relatório "Custo por Cliente".

## Detalhes técnicos

1. `src/pages/CalendarView.tsx`: renderizar `<TimeTracker instanceId={ev.instanceId} />` na linha de ações de cada variação de card de instância (são ~5 blocos repetidos de renderização: dia/pendentes, mês pendentes, atrasadas, concluídas, fora do prazo).
2. Reaproveita o componente `src/components/time-tracking/TimeTracker.tsx` já criado (modo compacto), sem novas queries por card além das que ele já faz, com realtime nos registros de tempo.
3. Sem alteração de banco de dados, edge functions ou layout dos demais elementos do card.
