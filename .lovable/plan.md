# Sincronizar status das obrigações no front

## Situação atual

Verifiquei agora as 53 instâncias da Folha de Pagamento 04/2026 → todas continuam com `status = 'pending'` no banco, mesmo as que já têm as 5 atividades concluídas (JR FOOD SERVICE, EMPREITEIRA SCHMITZ, etc.). Ou seja, ainda não há nada que mantenha `obligation_instances.status` em sincronia com as `obligation_activity_completions`.

Como várias telas (lista de obrigações, badges, métricas) leem `oi.status` direto, elas exibem "pendente" mesmo quando todas as atividades estão concluídas.

## Plano

### 1. Migration: trigger + backfill
Criar uma única migration com:

**a) Função `recalc_obligation_instance_status(_instance_id uuid)`**  
Conta atividades totais da obrigação vs. completions com `completed=true` daquela instância:
- 0 concluídas → `pending`
- todas concluídas → `done`
- algumas → `in_progress`

**b) Trigger `trg_oac_recalc_status`** em `obligation_activity_completions`  
Dispara `AFTER INSERT/UPDATE/DELETE FOR EACH ROW` chamando a função acima.  
SECURITY DEFINER, com `search_path = public`.

**c) Backfill one-shot**  
Um `UPDATE` que percorre todas as `obligation_instances` existentes aplicando a mesma lógica. Corrige imediatamente as 53 instâncias da Folha 04/2026 e qualquer outra obrigação afetada pelo bug histórico.

### 2. Verificação automática
Após a migration, rodo `SELECT status, count(*)` na obrigação Folha 04/2026 para confirmar que as 53 viraram `done`/`in_progress`/`pending` corretamente.

### 3. Front-end
Não há mudança de UI necessária:
- `Obligations.tsx`, `CalendarView.tsx`, `ClientObligationsTab.tsx` já leem `oi.status`.
- A tela de calendário também recalcula a partir das completions, mas continuará funcionando.

Apenas garanto via reload (`loadAll()`) que o estado fresco seja buscado quando o usuário abre a tela — já é o comportamento atual.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<timestamp>_recalc_instance_status.sql` | função + trigger + backfill |

Sem alterações em código TS/React.
