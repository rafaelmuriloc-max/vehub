# Duração dos chamados sempre preenchida

## O que foi verificado

- No banco, hoje, os 23 chamados encerrados têm `handle_seconds` gravado e apenas os 2 abertos estão sem duração.
- Na tela (print enviado) vários encerrados ainda aparecem com "—" — a lista está exibindo apenas o valor gravado no momento em que o chamado foi carregado/fechado, sem recalcular. Chamados encerrados por caminhos que não gravaram o campo (ou carregados antes do preenchimento) ficam com traço permanente.

## O que muda

- A duração passa a ser **calculada na exibição**, sem depender exclusivamente do campo gravado:
  1. usa `handle_seconds` quando existir e for coerente;
  2. senão, calcula `fechamento − abertura`;
  3. se o chamado está aberto, mostra o tempo decorrido desde a abertura com o rótulo "em andamento", atualizando sozinho enquanto a tela estiver aberta.
- Mesma regra na lista e no painel de detalhes.
- Formatação de duração mais legível (ex.: `2s`, `23min`, `1h20`, `3h05`).
- Correção de dados: recalcular `handle_seconds` de todos os chamados encerrados que estejam nulos ou inconsistentes com abertura/fechamento, para que relatórios futuros também fiquem certos.

## Detalhes técnicos

- `src/pages/Tickets.tsx`: `fmtDuration` passa a receber o ticket (`handle_seconds`, `opened_at`, `closed_at`, `status`) e resolver pela ordem acima; timer de 60s para atualizar chamados abertos.
- Uma atualização de dados única em `support_tickets` recalcula `handle_seconds = closed_at − opened_at` onde nulo ou negativo. A trigger `trg_ticket_normalize_dates` já mantém a coerência nas próximas gravações.
