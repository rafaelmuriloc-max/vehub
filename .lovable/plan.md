# Mostrar horário ao lado da data no calendário

## Objetivo
Na página do Calendário, a linha de data no topo ("quinta-feira, 17 de setembro de 2026") passa a exibir também o horário atual, ao lado da data — ex.: "quinta-feira, 17 de setembro de 2026 · 10:59".

## Mudanças
- `src/pages/CalendarView.tsx` (linha ~1221):
  - Incluir hora/minuto no mesmo `Intl.DateTimeFormat('pt-BR', ...)`: adicionar `hour: '2-digit', minute: '2-digit'` ao formatador existente, mantendo capitalização e estilo atuais.
  - O texto atualiza automaticamente a cada minuto (timer `useEffect` de 60 s no componente) para refletir o horário corrente sem recarregar a página.

## Fora de escopo
- Nenhuma outra tela, dado ou layout é alterado.
