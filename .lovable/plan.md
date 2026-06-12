## Objetivo
Fazer com que o quadro cruzado **Regime Tributário × Segmento** exclua clientes marcados como **"Sem mensalidade"** (`without_monthly_fee`), além de já filtrar apenas os ativos.

## Contexto
- Os gráficos de donut de Regime e Segmento já utilizam `payingClients`, que por definição exclui clientes sem mensalidade. Portanto, eles já estão corretos.
- O quadro cruzado (`crossData`, `cellData`, `rawStackedData`) atualmente filtra apenas por `status === 'active'`, mas ainda inclui clientes com `without_monthly_fee` na contagem de clientes por célula.

## Alteração
No arquivo `src/pages/Clients.tsx`, linha 1198, alterar o filtro do `forEach` que constrói os dados cruzados:

```js
// Antes
clients.filter(c => c.status === 'active').forEach(c => { ... })

// Depois
clients.filter(c => c.status === 'active' && !(c as any).without_monthly_fee).forEach(c => { ... })
```

Como o filtro principal já garante que nenhum cliente sem mensalidade entra no loop, o `if` interno (linha 1208) que verifica `!(c as any).without_monthly_fee` para calcular MRR e paying torna-se redundante e pode ser simplificado para sempre acumular, já que a condição externa já garante isso.

## Resultado
- O quadro cruzado passa a considerar apenas clientes **ativos E com mensalidade**.
- Contagem, MRR e ticket médio passam a refletir exatamente o mesmo universo dos gráficos de donut.