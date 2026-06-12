## Objetivo
Adicionar a informação de quantos clientes ativos estão com serviços suspensos por inadimplência no card **Ativos** da página `/clients`.

## Contexto
O card "Ativos" na página `Clients.tsx` atualmente exibe apenas o número total de clientes ativos (`activeCount`). O dashboard (`ClientsPanel.tsx`) já possui essa funcionalidade, mostrando um subtexto "X suspensos" no card Ativos.

## Implementação

### `src/pages/Clients.tsx`

1. **Adicionar contagem de suspensos**:
   - Após o cálculo de `activeCount` (linha 1036), adicionar:
     ```ts
     const suspendedCount = payingClients.filter(c => c.status === 'active' && c.services_suspended).length;
     ```

2. **Adicionar subtexto no card Ativos**:
   - No card "Ativos" (linha 1099), adicionar um parágrafo abaixo do número principal mostrando:
     ```tsx
     <p className="text-xs text-muted-foreground mt-1">{suspendedCount} suspensos</p>
     ```
   - Isso alinha visualmente com o padrão já implementado no dashboard (`ClientsPanel.tsx`).

## Critérios de aceitação
- O card "Ativos" na página `/clients` exibe o número total de clientes ativos e, logo abaixo, a quantidade de clientes ativos com `services_suspended = true`.
- A contagem respeita o filtro `payingClients` (exclui `without_monthly_fee`).
- O estilo visual segue o padrão do dashboard (texto pequeno, cor `muted-foreground`).