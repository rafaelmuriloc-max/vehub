## Objetivo

Rodar um backfill único: aplicar retroativamente a regra do trigger recém-criado para todos os clientes que já tiveram obrigações de departamento desmarcadas no passado.

## O que será executado

Um único `UPDATE` em `obligation_instances`, marcando `deleted_at = now()` para toda instância onde:

- `deleted_at IS NULL` (ainda ativa)
- É **futura**:
  - `due_date >= CURRENT_DATE`, **ou**
  - `due_date IS NULL AND reference_month >= date_trunc('month', CURRENT_DATE)::date`
- **Não existe** vínculo correspondente em `client_department_obligations` para o par `(client_id, obligation_id)`.

Instâncias passadas continuam preservadas para manter o histórico. Nenhuma alteração de estrutura ou de código.
