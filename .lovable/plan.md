## Objetivo

Quando o campo **Data de saída** (`clients.end_date`) de um cliente for preenchido, todas as obrigações desse cliente com vencimento a partir dessa data devem ser excluídas automaticamente (soft delete).

## Implementação

**1. Trigger no banco (`clients` AFTER UPDATE de `end_date`)**

- Dispara quando `end_date` passa de `NULL` para um valor, ou quando é alterado para uma data anterior.
- Marca como excluídas (`deleted_at = now()`) todas as linhas de `obligation_instances` do cliente onde:
  - `deleted_at IS NULL` (ainda ativas), e
  - `due_date >= NEW.end_date` **OU** `reference_month >= date_trunc('month', NEW.end_date)` (cobre obrigações sem `due_date` definido).
- Também aplicar em INSERT caso o cliente seja criado já com `end_date`.

**2. Backfill único**

- No mesmo migration, rodar o mesmo UPDATE para clientes que já possuem `end_date` preenchida hoje, garantindo consistência retroativa.

## Detalhes técnicos

- Soft delete (`deleted_at`), coerente com o resto do sistema — as queries já filtram `is('deleted_at', null)`.
- Nenhuma alteração de frontend necessária: as listas (Calendário, Dashboard, Obrigações) já ignoram `deleted_at`.
- Se o usuário limpar `end_date` posteriormente, as instâncias **não** são restauradas automaticamente (comportamento simples e previsível). Podem ser regeradas pelo fluxo normal de geração se necessário.
