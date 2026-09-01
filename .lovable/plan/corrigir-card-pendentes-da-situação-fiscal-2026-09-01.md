# Corrigir card "Pendentes" da Situação Fiscal

## Problema

O card "Pendente" conta 9 empresas, mas ao clicar a lista fica vazia.

Causa confirmada: o gráfico e a tabela usam critérios diferentes.

- O painel de gráficos classifica como "pending" qualquer registro cujo status não seja `regular`, `irregular` ou `error`. Hoje existem 14 clientes com status `sem_procuracao` no banco (além de 123 irregulares, 46 regulares e 22 com erro) — eles caem no balde "Pendente".
- A tabela, ao filtrar por "Pendente", só aceita clientes **sem nenhum status** (`sitfis_status` nulo). Como os 9 do card têm status `sem_procuracao`, nada aparece.

## Correção

1. Alinhar o filtro da tabela ao critério do gráfico: "Pendente" passa a incluir clientes sem consulta **e** clientes com status desconhecido/não mapeado.
2. Separar o status `sem_procuracao` como categoria própria no painel (card e donut com rótulo "Sem procuração"), para que "Pendente" volte a significar apenas "ainda não consultado".
3. Garantir que o filtro do select de status e o clique nos cards usem exatamente a mesma função de classificação, evitando divergências futuras.

## Detalhes técnicos

- `src/components/integra-contador/SitfisOverviewPanel.tsx`: adicionar `sem_procuracao` ao `STATUS_META` e ao mapa de contagens; extrair uma função `resolveStatusKey(status)` exportada.
- `src/components/integra-contador/SituacaoFiscalTab.tsx`: usar `resolveStatusKey` em `filtered` no lugar de `filterStatus === 'pending' && !c.sitfis_status`, e adicionar a opção "Sem procuração" no select de status (se ainda não existir).
- Sem alterações de banco de dados.
