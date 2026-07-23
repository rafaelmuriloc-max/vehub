## Objetivo
Adicionar a periodicidade **Trimestral** ao cadastro de obrigações, com geração correta das instâncias e vencimento fixo no mês seguinte ao trimestre.

## Regras de vencimento (trimestral)
| Trimestre | Competência (reference_month) | Vencimento bruto |
|---|---|---|
| Q1 (jan–mar) | 03/AAAA | 30/04/AAAA |
| Q2 (abr–jun) | 06/AAAA | 30/07/AAAA |
| Q3 (jul–set) | 09/AAAA | 30/10/AAAA |
| Q4 (out–dez) | 12/AAAA | 30/01/AAAA+1 |

Vencimento sempre no dia **30 do mês seguinte ao fim do trimestre**, sujeito à antecipação para o dia útil anterior via `previousBusinessDay` + feriados (padrão do projeto).

## Alterações em `src/pages/Obligations.tsx`

1. **Select de recorrência** (form novo/editar + filtro): adicionar `SelectItem value="trimestral"` (label "Trimestral") — selects nas linhas ~496, ~720.

2. **Regra de competência**: incluir `'trimestral'` na lista da linha 193 → `['mensal', 'anual', 'trimestral'].includes(...)`.

3. **Campo "Dia de vencimento"**: ocultar para trimestral (dia fixo = 30, definido pela regra). Manter apenas para mensal.

4. **Geração de instâncias (`generateObligationInstances`)** — novo ramo trimestral:
   - Para cada trimestre `q ∈ {1,2,3,4}` do ano corrente cujo mês final (`3*q`) seja ≥ ao "Mês de início" selecionado:
     - `reference_month` = `AAAA-{3*q}-01`
     - Mês/ano de vencimento: `3*q + 1` (se `q === 4` → mês 01 do ano seguinte)
     - `rawDueDate` = dia 30 desse mês/ano
     - `due_date` = `previousBusinessDay(rawDueDate, getHolidays(anoDoVencimento))`
   - Dedup pelo par `(client_id, reference_month)` como já é feito.

5. **UI "Gerar Obrigações"**: reutilizar o seletor de "Mês de início" já existente; adaptar o texto para "Serão geradas obrigações dos trimestres a partir de {mês} até o Q4 de {ano}".

## Fora de escopo
- Sem mudanças de schema (`recurrence` já aceita texto).
- Sem alterações em triggers, calendário ou reconciler — usam `reference_month`/`due_date` das instâncias.
