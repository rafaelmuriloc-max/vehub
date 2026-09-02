# Remover rótulo "em andamento" da coluna Duração

Ajustar a exibição da coluna **Duração** na tabela de `/tickets` para ocupar menos espaço visual.

## O que muda

- Remove o sufixo `(em andamento)` dos chamados com status **Aberto**.
- Para chamados abertos, exibe apenas o tempo decorrido no mesmo formato dos chamados encerrados (ex.: `5min`, `2h05`).
- Mantém o cálculo dinâmico e a atualização automática a cada 60s.

## Arquivo alterado

- `src/pages/Tickets.tsx`
  - Ajustar a função `ticketDuration` para retornar `fmtDuration(elapsed)` sem o sufixo quando o chamado está aberto.
  - Preservar as regras de fallback: `handle_seconds` → `closed_at - opened_at` → tempo decorrido.
