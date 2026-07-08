## Objetivo

Quando uma obrigação de departamento for desvinculada de um cliente (linha removida em `client_department_obligations`), todas as **obrigações futuras** daquele cliente para aquela obrigação devem ser automaticamente excluídas (soft delete em `obligation_instances`).

Exemplo: cliente 20 - Ramonisa deixou de ter folha de pagamento → ao desmarcar as obrigações do departamento Pessoal no cadastro, as instâncias futuras dessas obrigações são apagadas.

## Implementação

**Trigger `AFTER DELETE` em `client_department_obligations`**

Ao remover uma linha `(client_id, obligation_id, department_id)`:

- Marca `deleted_at = now()` em `obligation_instances` onde:
  - `client_id = OLD.client_id`
  - `obligation_id = OLD.obligation_id`
  - `deleted_at IS NULL`
  - E é considerada **futura**:
    - `due_date >= CURRENT_DATE`, **ou**
    - `due_date IS NULL AND reference_month >= date_trunc('month', CURRENT_DATE)::date`

Instâncias passadas (já vencidas / mês anterior) permanecem intocadas para preservar o histórico.

## Detalhes técnicos

- Soft delete, coerente com o resto do sistema (queries já filtram `is('deleted_at', null)`).
- Se a obrigação for religada depois, as instâncias futuras podem ser regeradas pelo fluxo normal de geração — não há restauração automática (mesmo comportamento adotado no trigger de `end_date`).
- Nenhuma alteração de frontend necessária.
