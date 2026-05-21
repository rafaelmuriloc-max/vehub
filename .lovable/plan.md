## Correção dos códigos SERPRO de parcelamento

A consulta de parcelas e a emissão de guia falharam com "Identificação do sistema ou serviço inválida" porque os códigos usados (`PARCELASPARAIMPRESSAO16x` / `EMITIRDAS16x`) não existem no catálogo. Os corretos, confirmados pela documentação SERPRO e por `src/pages/IntegraContador.tsx`, são:

| Modalidade   | Pedidos         | Parcelas p/ gerar      | Emitir DAS    |
|--------------|-----------------|------------------------|---------------|
| PARCSN       | PEDIDOSPARC163  | PARCELASPARAGERAR162   | GERARDAS161   |
| PARCSN-ESP   | PEDIDOSPARC173  | PARCELASPARAGERAR172   | GERARDAS171   |
| PERTSN       | PEDIDOSPARC183  | PARCELASPARAGERAR182   | GERARDAS181   |
| RELPSN       | PEDIDOSPARC193  | PARCELASPARAGERAR192   | GERARDAS191   |
| PARCMEI      | PEDIDOSPARC203  | PARCELASPARAGERAR202   | GERARDAS201   |
| PARCMEI-ESP  | PEDIDOSPARC213  | PARCELASPARAGERAR212   | GERARDAS211   |
| PERTMEI      | PEDIDOSPARC223  | PARCELASPARAGERAR222   | GERARDAS221   |
| RELPMEI      | PEDIDOSPARC233  | PARCELASPARAGERAR232   | GERARDAS231   |

## Mudanças

Arquivo único: `src/components/integra-contador/ParcelamentosTab.tsx`

1. Reescrever a tabela `PARCELAS_SERVICES` com os códigos acima (`parcelasService` = `PARCELASPARAGERAR{x}2`, `emitirService` = `GERARDAS{x}1`).
2. Em `extractParcelasList`, aceitar também o shape `listaParcelas[].parcela` / `valor` retornado por `PARCELASPARAGERAR` (já há fallback genérico, mas reforçar).
3. No diálogo de detalhes: se `detailRow.situacao` casar com `/encerrad|liquidad|rescind/i`, exibir aviso "Parcelamento encerrado — sem parcelas a emitir" e não disparar a consulta.
4. Quando a API responder lista vazia, mostrar "Nenhuma parcela em aberto até hoje" em vez de erro vermelho.

Sem alterações em banco, edge function ou outros arquivos.
