# Corrigir as datas do PIS / COFINS

## O que os dados mostram

O cadastro do PIS / COFINS tem alerta no dia 15, meta no dia 20 e vencimento no dia 25. Mas quase todas as obrigações geradas estão gravadas com vencimento no **dia 20** (o dia da meta), antecipado quando cai em fim de semana. Só um punhado ficou no dia 25:

- 09/2026: 65 no dia 18 e 4 no dia 25
- 10/2026: 65 no dia 20 e 4 no dia 23
- 11/2026: 65 no dia 20 e 4 no dia 25
- 12/2026: 65 no dia 18 e 4 no dia 24

É a mesma inconsistência que o ISS tinha: o vencimento foi gravado com o dia da meta.

## Correção

Padronizar o vencimento do PIS / COFINS no **dia 25**, antecipando para o dia útil anterior quando cair em sábado, domingo ou feriado, para todas as competências **a partir de setembro/2026** (as anteriores ficam como estão, para preservar o histórico).

Datas resultantes:
- Set/2026 → 25/09 (sexta)
- Out/2026 → 23/10 (dia 25 é domingo)
- Nov/2026 → 25/11 (quarta)
- Dez/2026 → 24/12 (dia 25 é feriado)

## Detalhes técnicos

- Atualizar `obligation_instances.due_date` das instâncias de PIS / COFINS (`obligation_id = c6359c67-...`) com `reference_month >= 2026-09-01` e `deleted_at is null`, aplicando dia 25 do mês de referência com antecipação para o dia útil anterior (feriados conforme `src/lib/holidays.ts`).
- Conferir se novas competências nascem com `due_date` calculado a partir de `due_day = 25` já com antecipação; corrigir no ponto de geração se estiver usando outro dia.
- Sem mudanças de interface, de schema ou de edge functions.

## Validação

- No calendário, o PIS / COFINS de setembro em diante aparece numa única data por mês (25 ou dia útil anterior), sem o grupo antigo no dia 20.
