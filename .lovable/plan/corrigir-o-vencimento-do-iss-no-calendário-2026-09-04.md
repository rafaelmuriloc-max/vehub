# Corrigir o vencimento do ISS no calendário

## O que os dados mostram

O cadastro da obrigação ISS está com vencimento no **dia 10** (com alerta no dia 5 e meta no dia 7), mas quase todas as obrigações geradas estão com data no **dia 20** (antecipada quando cai em fim de semana). Só um punhado ficou no dia 10:

- 09/2026: 64 no dia 18 e 3 no dia 10
- 10/2026: 64 no dia 20 e 3 no dia 09
- 11/2026: 64 no dia 20 e 3 no dia 10
- 12/2026: 64 no dia 18 e 3 no dia 10

## Correção

Padronizar o ISS no **dia 10**, antecipando para o dia útil anterior quando cair em sábado, domingo ou feriado, para todas as competências **a partir de setembro/2026** (as anteriores ficam como estão, para preservar o histórico).

Datas resultantes:
- Set/2026 → 10/09 (quinta)
- Out/2026 → 09/10 (dia 10 é sábado)
- Nov/2026 → 10/11 (terça)
- Dez/2026 → 10/12 (quinta)

## Detalhes técnicos

- Atualizar `obligation_instances.due_date` das instâncias do ISS (`obligation_id = 3f17b540-...`) com `reference_month >= 2026-09-01` e `deleted_at is null`, aplicando dia 10 do mês de referência com antecipação para o dia útil anterior (feriados nacionais conforme `src/lib/holidays.ts`).
- Conferir o ponto de geração de instâncias para garantir que novas competências de ISS nasçam com `due_date` calculado a partir de `due_day = 10` já com antecipação — se estiver criando com outro dia, corrigir ali.
- Sem mudanças de interface, de schema ou de edge functions.

## Validação

- No calendário, as obrigações de ISS de setembro em diante devem aparecer no dia 10 (ou no dia útil anterior), sem duplicidade de datas no mesmo mês.
