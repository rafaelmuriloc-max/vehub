# Filtro por regime tributário no Calendário

## O que muda
Adicionar um seletor "Regime tributário" na barra de filtros da tela do Calendário, junto dos filtros de departamento, empresa e obrigação, com opções: Todos, Não informado e os regimes encontrados entre os clientes (Simples Nacional, Lucro Presumido, Lucro Real, MEI).

## Como vai funcionar
- O filtro se combina com departamento, empresa, obrigação e "entregues fora do prazo".
- Afeta o calendário, as listas de obrigações, as tarefas, as excluídas, os medidores de desempenho (geral e departamentais), os quatro cards de indicadores e o contador do botão Filtros.
- Reutiliza `TAX_REGIME` e `normalizeTaxRegime()` de `src/lib/utils.ts`, no mesmo padrão já usado em Situação Fiscal e Notas Fiscais.

## Detalhes técnicos
- Arquivo: `src/pages/CalendarView.tsx` (somente).
- Incluir `tax_regime` no select de `clients` e no tipo local.
- Estado `filterRegime` (default `'all'`); opções dinâmicas a partir dos valores distintos de `tax_regime` + `'none'` para não informado.
- Aplicar a condição em todas as cadeias de filtro existentes (eventos do mês, tarefas, tarefas atrasadas, instâncias excluídas, métricas de desempenho), comparando o regime do cliente via `clientMap`.
- Incluir `filterRegime` no cálculo de `activeFilters` e nos resets de paginação.
- Seletor com `Select` padrão, seguindo o layout responsivo atual.
- Sem mudanças de banco, backend ou RLS.
