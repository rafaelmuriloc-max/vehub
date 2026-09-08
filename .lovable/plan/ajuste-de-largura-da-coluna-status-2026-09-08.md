# Ajuste de largura da coluna Status

## Objetivo
Diminuir a largura da coluna "Status" na tabela de situação fiscal, já que ela agora exibe apenas o símbolo (sem texto).

## Alteração
- Arquivo: `src/components/integra-contador/SituacaoFiscalTab.tsx`
- Local: cabeçalho `<TableHead className="w-36">Status</TableHead>`
- Ação: reduzir a classe de largura de `w-36` para `w-16` (ou `w-20`, conforme aprovação visual), liberando espaço para as demais colunas.

## Critérios de aceitação
- A coluna Status deve ocupar menos espaço horizontal.
- Os símbolos de status (verde/vermelho) continuam visíveis e centralizados.
- Nenhuma outra funcionalidade da tabela é alterada.
