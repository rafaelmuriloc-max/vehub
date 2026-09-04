# Corrigir datas de vencimento das obrigações

Levantamento feito sobre todas as tarefas futuras. Três casos encontrados, todos serão corrigidos.

## 1. Vencimento caindo no domingo 20 (mesmo problema do DAS)

| Obrigação | 20/09/2026 | 20/12/2026 |
|---|---|---|
| Darf Previdenciário | 51 empresas | 51 empresas |
| FGTS | 35 empresas | 35 empresas |

Nas mesmas competências, parte das empresas já está corretamente em 18/09 e 18/12, então a base está dividida.

Correção: mover essas tarefas para 18/09 e 18/12 (sexta anterior).

Nenhuma outra tarefa futura cai em sábado, domingo ou feriado nacional.

## 2. MIT para o dia 25

O MIT está cadastrado com vencimento no dia 25, mas 66 empresas por mês estão em datas diferentes (15/09, 15/10, 13/11, 15/12) e apenas 3 seguem o dia 25.

Correção, a partir da competência 09/2026 (meses anteriores preservados):
- Set/2026 → 25/09
- Out/2026 → 23/10 (dia 25 é domingo)
- Nov/2026 → 25/11
- Dez/2026 → 24/12 (dia 25 é feriado)

## 3. Adiantamento Salarial para o dia 20

O Adto Salarial tem cerca de 12 empresas por mês sem nenhuma data de vencimento e 4 com data preenchida.

Correção, a partir da competência 09/2026: todas passam a vencer no dia 20, antecipando para o dia útil anterior:
- Set/2026 → 18/09 (dia 20 é domingo)
- Out/2026 → 20/10
- Nov/2026 → 20/11
- Dez/2026 → 18/12 (dia 20 é domingo)

## Detalhes técnicos

- Atualizações de dados em `obligation_instances` (`deleted_at is null`), sem mudanças de interface, schema ou edge functions.
- Item 1: Darf Previdenciário e FGTS com `due_date in ('2026-09-20','2026-12-20')` → menos 2 dias.
- Itens 2 e 3: recalcular `due_date` a partir do dia cadastrado (25 e 20) para `reference_month >= 2026-09-01`, com antecipação para dia útil anterior conforme feriados de `src/lib/holidays.ts`.
- Validação final: conferir contagem por competência e data para cada obrigação.
