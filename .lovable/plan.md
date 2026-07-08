## Objetivo

Backfill único: apagar todas as instâncias **não concluídas** (passadas e futuras) de obrigações que não têm mais vínculo com o cliente em `client_department_obligations`. Trigger permanente permanece limitado a instâncias futuras (comportamento atual).

## O que será executado

`UPDATE` em `obligation_instances`, marcando `deleted_at = now()` para toda instância onde:

- `deleted_at IS NULL`
- `status <> 'done'` (mantém histórico de concluídas)
- **Não existe** vínculo correspondente em `client_department_obligations` para o par `(client_id, obligation_id)`.

Sem filtro de data — cobre atrasadas e futuras. Nenhuma alteração de trigger, estrutura ou código.
