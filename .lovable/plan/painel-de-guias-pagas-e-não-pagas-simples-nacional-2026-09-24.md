# Painel de guias pagas e não pagas — Simples Nacional

## O que muda
No topo da tela Fiscal > Simples Nacional, acima da lista de empresas, entra um painel com a situação das guias (DAS) do ano escolhido.

## O que o painel mostra
- **4 cartões:** Guias pagas, Guias em aberto (já vencidas), Guias a vencer (vencimento ainda não chegou) e % pagas.
- **Gráfico por mês:** barras de jan a dez com pagas e não pagas lado a lado.
- **Empresas com guias em aberto:** lista das empresas com mais meses sem pagamento. Clicar numa empresa filtra a lista e abre a empresa.
- Clicar num cartão filtra a lista de empresas (ex.: só quem tem guia em aberto). Um botão "Limpar filtro" desfaz o filtro.

## Regras
- Usa os dados que já existem no sistema. Nada é consultado na Receita ao abrir a tela.
- Os meses futuros sem guia não contam como "em aberto".
- Guia vencida = data de vencimento já passou; quando a data não estiver disponível, conta como vencida o mês até o dia 20 do mês seguinte.
- Hoje o sistema não tem o **valor** das guias guardado (está vazio em todas). Por isso o painel mostra **quantidades**, não valores em reais.
- Hoje o sistema mostra 40 guias pagas e 1.182 em aberto. Os números só ficam corretos depois de rodar **Atualizar situação** por completo.

## Técnico
- Novo componente `src/components/simples-nacional/SimplesDashboard.tsx`, recebendo `clients`, `competencias` e `year` que já são carregados em `SimplesNacionalTab.tsx`.
- Cálculos no cliente com `useMemo`; gráfico com Recharts (já usado no projeto); cartões no mesmo estilo do `MetricCard`.
- Em `SimplesNacionalTab.tsx`: novo estado `statusFilter` ('all' | 'aberto' | 'pago' | 'a_vencer') aplicado em `filtered` antes da paginação; reset da página ao mudar.
- Cores pelos tokens do tema (sem cores fixas).
- Nada muda no banco nem nas funções do servidor.
