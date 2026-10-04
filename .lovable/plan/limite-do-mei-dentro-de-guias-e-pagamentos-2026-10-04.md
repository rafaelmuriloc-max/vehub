# Limite do MEI dentro de Guias e Pagamentos

## O que muda
- Sai a aba **Controle de Limite**; a tela MEI volta a ter uma única área (sem abas).
- Em cada empresa da lista de Guias e Pagamentos aparece, logo abaixo do nome e do status da guia, uma linha de limite do ano escolhido:
  - barra de progresso colorida (normal, alerta a partir de 80%, excedido em vermelho);
  - "R$ faturado de R$ limite · X%" e o selo da situação (Normal, Em alerta, Excesso até 20%, Excesso acima de 20%);
  - limite proporcional quando a empresa abriu no próprio ano.
- Um botão **Ver meses e notas** em cada empresa abre o mesmo detalhe de hoje (faturamento mês a mês, notas e alerta de desenquadramento).
- Novo cartão no topo: **Em alerta / excedidas no limite**, que ao clicar filtra a lista por essas empresas.
- O faturamento continua vindo das NF-e de saída e NFC-e não canceladas; nota explicativa curta abaixo dos cartões.

## Detalhes técnicos
- Extrair de `MeiLimitTab.tsx` um hook `useMeiLimits(clientIds, ano)` (busca notas em lotes, aplica `limiteAnual`/`faixaDe`/`somarPorMes`/`projecao`) e o diálogo de detalhe como componente `MeiLimitDialog`.
- `MeiTab.tsx`: remover `Tabs`; usar o hook com os clientes MEI e o ano já selecionado; renderizar barra + selo em cada linha; novo filtro `limite` no `statusFilter`; cartão extra (grid 5 colunas no desktop).
- Remover a aba e o componente de tabela `MeiLimitTab` (o arquivo passa a exportar só hook e diálogo). Regras de `meiLimit.ts` e testes sem mudança.
