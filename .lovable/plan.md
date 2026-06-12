## Ajuste
Restringir a contagem de "suspensos" exibida no card Ativos para considerar apenas clientes com `status = 'active'` E `services_suspended = true` (clientes ativos mas suspensos por inadimplência).

## Alteração
Em `src/components/dashboard/ClientsPanel.tsx`, adicionar `.eq('status', 'active')` à query de suspensos:

```ts
supabase.from('clients')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'active')
  .eq('services_suspended', true)
```

O subtexto "X suspensos" no card Ativos passa a refletir somente os ativos inadimplentes.