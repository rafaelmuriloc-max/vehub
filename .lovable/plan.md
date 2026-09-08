# Filtro por regime tributário na Situação Fiscal

## O que muda
Na aba **Situação Fiscal** (tela Fiscal), adicionar um filtro por regime tributário ao lado do filtro de situação (Regular/Irregular/etc.).

## Como vai funcionar
- Novo seletor "Regime tributário" com opção "Todos" + os regimes encontrados nas empresas listadas (Simples Nacional, Lucro Presumido, Lucro Real, MEI etc., conforme cadastro de cada empresa).
- Empresas sem regime informado aparecem quando o filtro está em "Todos" e podem ser isoladas com a opção "Não informado".
- O filtro se combina com a busca e o filtro de situação já existentes, afetando a tabela, os contadores do painel, o download em lote e a consulta em lote (tudo já usa a mesma lista filtrada).

## Detalhes técnicos
- Arquivo: `src/components/integra-contador/SituacaoFiscalTab.tsx` (único).
- Incluir `tax_regime` no select de `clients` e no tipo `ClientWithSitfis`.
- Estado `filterRegime` (default `'all'`), opções montadas dinamicamente a partir dos valores distintos de `tax_regime`, mais `'none'` para não informado.
- Adicionar condição no `filtered`; layout responsivo seguindo o padrão dos filtros atuais.
- Sem mudanças de banco, backend ou RLS.
