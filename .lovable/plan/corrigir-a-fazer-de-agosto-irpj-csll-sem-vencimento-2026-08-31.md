# Corrigir "A Fazer" de agosto (IRPJ/CSLL sem vencimento)

## Diagnóstico (confirmado nos dados)

As **49 obrigações "A Fazer"** de agosto são todas instâncias de **IRPJ / CSLL (trimestral)** que ficaram **sem data de vencimento** (`due_date` nulo e a obrigação sem `due_day`). Sem vencimento, o calendário não consegue classificá-las como atrasadas nem agendadas — elas caem sempre no "A Fazer", mês após mês.

## Correção

1. **Cadastro da obrigação**: gravar `due_day = 30` na obrigação trimestral IRPJ/CSLL (a tela já exibe 30 fixo, mas o valor não está salvo).
2. **Backfill das instâncias**: preencher `due_date` das instâncias trimestrais existentes sem data — regra: **dia 30 do mês seguinte ao fim do trimestre** (competência 03/2026 → 30/04/2026, 06/2026 → 30/07/2026, 09/2026 → 30/10/2026, 12/2026 → 30/01/2027), antecipando para o dia útil anterior se cair em fim de semana/feriado.
3. **Geração futura**: garantir que novas instâncias trimestrais já nasçam com `due_date` calculado pela mesma regra.

## Detalhes técnicos

- SQL (run_sql): `update obligations set due_day = 30 where recurrence = 'trimestral' and due_day is null;` e `update obligation_instances` calculando `due_date` a partir de `reference_month` (mês da competência é o último do trimestre) usando `previousBusinessDay`/feriados.
- Verificar o trecho de geração de instâncias (batch em `Obligations.tsx` / geração automática) para incluir o cálculo de `due_date` quando `recurrence = 'trimestral'`.

## Resultado esperado

- As 49 instâncias passam a ter vencimento real e são classificadas corretamente (Atrasadas / A Fazer conforme a data), zerando o "limbo" no card de agosto.
