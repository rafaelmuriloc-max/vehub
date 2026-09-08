# Excluir botão "Reclassificar relatórios"

## Objetivo
Remover o botão "Reclassificar relatórios" do cabeçalho da tabela de situação fiscal, juntamente com todo o estado e lógica que só existiam para ele.

## Escopo
- `src/components/integra-contador/SituacaoFiscalTab.tsx`

## O que será feito
1. Remover o estado `reclassifying` e `reclassProgress` (linhas 80-81).
2. Remover `reclassifying` da dependência do `useEffect` que atualiza `busyRef` (linha 136).
3. Remover a função `handleReclassificar` (linhas 185-229).
4. Remover o botão JSX "Reclassificar relatórios" do grupo de ações do cabeçalho (linhas 766-783).

## O que NÃO será alterado
- Outros botões do cabeçalho ("Baixar PDFs", "Consultar em Lote").
- Filtros, paginação, tabela, diálogos e consulta em lote.
- Edge functions, banco de dados, RLS ou outras telas.
- Importações compartilhadas (`RefreshCw`, `analyzeSitfisReport`, `extractPdfInfoFromBase64`) que ainda são usadas em outros pontos do componente.

## Validação
- TypeScript check.
- Build.
- Verificação visual de que o botão desapareceu e os demais continuam alinhados.
