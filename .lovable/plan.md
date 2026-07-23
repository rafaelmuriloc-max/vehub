## Problema

As instâncias trimestrais de **IRPJ/CSLL** referentes a Q3/2026 (ref 09/2026, vence 30/10) e Q4/2026 (ref 12/2026, vence 30/01/2027) estão marcadas como `deleted_at`. Q2/2026 (ref 06, vence 30/07) permaneceu ativa.

**Causa:** o backfill executado anteriormente ("excluir obrigações futuras de empresas sem link em `client_department_obligations`") avaliou pelo `reference_month >= mês atual`. Como o IRPJ/CSLL trimestral usa competência = último mês do trimestre, apenas Q2 (ref 06/2026, já no passado em relação a julho/2026) escapou. Os 66 clientes continuam com o vínculo em `client_department_obligations` — a exclusão foi indevida.

## Correção

Restaurar (`deleted_at = NULL`) as instâncias de IRPJ/CSLL cujo cliente ainda possui vínculo ativo com essa obrigação em `client_department_obligations`:

```sql
UPDATE obligation_instances oi
   SET deleted_at = NULL
 WHERE oi.obligation_id = '4cf4c4d5-c565-4266-9cfe-7e90fa280927'
   AND oi.deleted_at IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM client_department_obligations cdo
      WHERE cdo.client_id = oi.client_id
        AND cdo.obligation_id = oi.obligation_id
   );
```

Depois: confirmar contagem por competência (esperado 66 ativas em 06, 09 e 12/2026) e validar no calendário nos meses de vencimento (jul/out/2026 e jan/2027).

## Prevenção

Ajustar futuras rotinas de limpeza para obrigações **trimestrais**: comparar por `due_date` (não por `reference_month`), já que a competência é anterior ao vencimento e induz falsos positivos de "instância futura".
