# Duração dos chamados sempre preenchida

## O que foi verificado

Consulta na tabela de chamados: dos 25 chamados existentes, os 23 fechados têm duração gravada corretamente. Os únicos sem duração são os 2 chamados ainda **abertos** — a duração só é calculada no fechamento, então a coluna mostra "—".

## O que muda

- Chamados abertos passam a exibir a **duração em andamento** (tempo desde a abertura até agora), com indicação de que ainda está em curso (ex.: `1h 12min (em andamento)`), atualizada automaticamente enquanto a tela estiver aberta.
- Chamados fechados que, por qualquer motivo, estejam sem o valor gravado passam a calcular a duração a partir de abertura x fechamento na exibição, em vez de mostrar "—".
- Mesma regra aplicada na lista e no painel de detalhes do chamado.

## Detalhes técnicos

- `src/pages/Tickets.tsx`: helper de duração passa a receber o ticket inteiro e resolver na ordem `handle_seconds` → `closed_at - opened_at` → `now - opened_at` (aberto). Timer leve (1 min) para atualizar chamados abertos.
- Nenhuma alteração de banco necessária: a trigger de normalização já garante `handle_seconds` coerente no fechamento.
