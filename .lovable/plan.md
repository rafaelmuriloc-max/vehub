# Empresas inativas fora da Pessoal e do Férias

Empresas com status "Inativa" deixam de aparecer e de entrar em qualquer número das telas Pessoal e Férias. Os dados delas continuam no banco — nada é excluído, só deixa de ser exibido nessas duas telas.

## Tela Pessoal (`src/pages/Personnel.tsx`)

- Nova lista interna com somente as empresas ativas; todos os cálculos passam a usar essa lista:
  - Funcionários ativos, total de salários, empresas com funcionários, experiências e férias dos cards.
  - Alertas de experiência e de férias (incluindo os diálogos que abrem ao clicar nos cards).
  - Métricas por empresa da tabela e dos cards.
- Lista de empresas mostra apenas empresas ativas (a condição atual que já esconde empresas sem funcionários ativos é mantida).
- Filtro "Status" (Todas/Ativas/Inativas) sai da barra de busca, pois não faz mais sentido — só existe empresa ativa na lista.
- Coluna "Status" (Ativa/Inativa) sai da tabela; a exportação em CSV também deixa de ter essa coluna.
- O texto "X empresa(s) sem funcionário(s)" do card passa a contar só entre as empresas ativas.

## Tela Férias (`src/pages/Vacations.tsx`)

- A consulta de empresas passa a buscar também o status e considera somente as ativas.
- Colaboradores de empresas inativas saem de todos os números: cards, gráficos, vencimentos por mês e tabela de colaboradores.
- O seletor de empresas (Combobox) lista apenas empresas ativas, incluindo a opção "Todas as empresas".

## O que não muda

- Nada é apagado ou alterado no banco; funcionários de empresas inativas continuam cadastrados.
- Cadastro de funcionários, sincronizações (Pasta, Experiência, Férias), paginação e demais regras seguem como estão.
- Sem migração de banco: a coluna de status já existe em `clients`.

## Validação

- `bunx tsgo --noEmit` e build.
