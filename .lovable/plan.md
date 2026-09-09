# Mover botões de ação acima do painel de gráficos

Reposicionar os botões **"Baixar PDFs"** e **"Consultar em Lote"** de dentro do card da tabela para uma barra de ações acima do painel `SitfisOverviewPanel` (gráficos de situação geral e tipos de pendência).

## Escopo
- Apenas `src/components/integra-contador/SituacaoFiscalTab.tsx`.
- Mudança de layout/posicionamento; nenhuma alteração de lógica, estados, handlers, banco, edge functions ou RLS.

## Mudanças
1. Criar uma barra superior flexível logo após a tag de abertura do container principal, contendo:
   - Título/área vazia à esquerda (ou título da seção, se desejado).
   - Os dois botões à direita: **Baixar PDFs** e **Consultar em Lote**, preservando estados de loading, contadores e disabled conditions atuais.
2. Remover esses botões do `CardHeader` do card "Situação Fiscal dos Clientes".
3. Manter os filtros de busca, status, regime e as abas com contadores no lugar atual.

## Validação
- Typecheck e build local.
- Verificar no preview se os botões aparecem alinhados acima dos gráficos e continuam funcionando (download em lote e consulta em lote).
