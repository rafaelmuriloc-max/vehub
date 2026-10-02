# Gráfico de evolução na página Pessoal

## O que muda
- Na página Pessoal entra um gráfico **Evolução de funcionários e salários**, logo abaixo dos cartões de resumo.
- Ele mostra cada mês da folha: as **barras** são a quantidade de funcionários e a **linha** é o total de salários (proventos), em reais.
- Os dados vêm dos relatórios da Folha já sincronizados (hoje, de janeiro a agosto de 2026). Novos meses entram sozinhos sempre que a Folha for sincronizada.
- Ao passar o mouse sobre um mês, aparecem os valores exatos e quantas empresas entraram naquele mês.
- O gráfico mostra o total do escritório e não muda com a busca nem com os filtros da lista.
- Empresas inativas ficam de fora, como no resto da página.
- Uma nota pequena avisa que o gráfico só considera as empresas que têm relatório de folha.

## Detalhes técnicos
- `src/pages/Personnel.tsx`: buscar em `payroll_summaries` os campos `client_id, competence, qty_employees, gross`, só das empresas ativas já carregadas. Agrupar por `competence`, somando funcionários e proventos e contando as empresas.
- Gráfico combinado do Recharts (`ComposedChart`, com `Bar` e `Line` e dois eixos Y), usando as cores da página. Os meses aparecem como "jan/26", e o eixo dos valores em BRL compacto.
- Quando não houver dados, mostrar a mensagem "Sincronize a Folha para ver a evolução".
- Não muda nada no banco de dados. Depois da mudança, rodar `bunx tsgo`.
