

# Gráfico de Evolução de Clientes por Data de Abertura

## Contexto

Atualmente o gráfico de "Evolução de Clientes" usa `start_date` (ou `created_at` como fallback) para determinar quais clientes estavam ativos em cada mês. O pedido é usar a **data de abertura da empresa** (`opening_date`) como base para o gráfico.

## Alteração

No `src/pages/Dashboard.tsx`:

1. **Atualizar a query** para incluir `opening_date` no select dos clientes
2. **Alterar a lógica de evolução** para usar `opening_date` como critério principal:
   - Contar quantas empresas foram abertas (`opening_date`) em cada mês dos últimos 12 meses
   - Mostrar também o acumulado (total de empresas abertas até aquele mês)
3. **Renomear o gráfico** para "Evolução de Clientes (por abertura)" para deixar claro o critério

A lógica passará de "clientes ativos no mês" para "clientes com `opening_date` até aquele mês" (acumulado) e "novos no mês" como dado secundário.

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `src/pages/Dashboard.tsx` | Incluir `opening_date` na query, recalcular evolução usando `opening_date`, atualizar título do gráfico |

