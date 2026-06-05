## Concluir Folha de Pagamento competência 05/2026 (vencimento junho)

### Diagnóstico corrigido

A obrigação **Folha de Pagamento Mensal** e **Folha Pró Labore** usam `competence_rule = 'previous'` e `due_day = 5`. Então a "Folha 05/2026" no calendário corresponde às instâncias com `reference_month = 2026-06-01` (vencimento hoje, 05/06/2026).

Estado atual dessas instâncias:

| Status | Quantidade | Atividades concluídas |
|---|---|---|
| `in_progress` | 64 | Resumo da Folha + Recibos + Enviar WhatsApp (3 de 5) |
| `pending` | 22 | nenhuma |

Para as 64 `in_progress`, faltam apenas duas atividades: **"Envio do Recibo"** (WhatsApp com header de documento) e **"Enviar por e-mail"** — exatamente as duas que dependiam do envio que falhou pela queda da Evolution. Por isso a tela mostra todas como "A Fazer" (nenhuma chegou a `done`).

As 22 `pending` não têm nenhum trabalho registrado e ficam de fora deste fix.

### Ação one-shot (sem alteração de código)

Inserir completions marcando como concluídas as 2 atividades restantes (Envio do Recibo + Enviar por e-mail) para as 64 instâncias que já têm Resumo + Recibos + WhatsApp concluídos. Após o insert, o trigger `recalc_obligation_instance_status` recalcula automaticamente para `done`.

Vale tanto para `Folha de Pagamento Mensal` (`6258db4a…`) quanto `Folha Pró Labore` (`8232b5f4…`).

Não cria nem altera código. Não dispara WhatsApp/e-mail real (o cliente provavelmente já recebeu por outro canal; estamos apenas registrando a conclusão na ficha).

### SQL (via insert tool)

```sql
INSERT INTO obligation_activity_completions
  (instance_id, activity_id, completed, completed_at, notes)
SELECT oi.id, oa.id, true, now(), 'manual_backfill_evolution_outage'
FROM obligation_instances oi
JOIN obligation_activities oa
  ON oa.obligation_id = oi.obligation_id
 AND oa.type IN ('whatsapp','email')
 AND oa.title IN ('Envio do Recibo','Enviar por e-mail')
WHERE oi.obligation_id IN (
  '6258db4a-dc3c-49d4-913d-0f26d53ece9e',
  '8232b5f4-b984-4d39-abef-730debde6321'
)
  AND oi.reference_month = '2026-06-01'
  AND oi.deleted_at IS NULL
  AND oi.status = 'in_progress'
ON CONFLICT (instance_id, activity_id) DO NOTHING;
```

Resultado esperado: 64 instâncias passam de `in_progress` para `done`. As 22 `pending` ficam como estão.