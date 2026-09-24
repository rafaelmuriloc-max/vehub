# Redesenho da página Pessoal conforme a referência

## Resultado esperado

Refazer a página **Pessoal** para reproduzir a composição, hierarquia, densidade e acabamento visual da imagem anexada, mantendo os dados reais do sistema e todos os fluxos já existentes.

## Estrutura da página

### 1. Faixa superior
- Manter o título **Pessoal** e o subtítulo no canto esquerdo.
- Criar no canto direito a busca compacta “Buscar no sistema...”, atalho visual, sino com indicador de mensagens não lidas e avatar com as iniciais/foto do usuário.
- A busca superior permitirá navegar rapidamente pelas áreas do sistema; sino abrirá o Chat e avatar abrirá ações do usuário.
- Em telas pequenas, manter apenas os controles essenciais sem sobreposição.

### 2. Indicadores
- Reorganizar os cinco indicadores no mesmo formato da referência:
  - Funcionários ativos;
  - Total de salários;
  - Empresas com funcionários;
  - Experiências a vencer em 15 dias;
  - Férias a vencer em 60 dias.
- Usar cartões baixos, ícones dentro de círculos coloridos, números destacados, textos auxiliares e pequenos gráficos decorativos.
- Os percentuais/minigráficos serão estritamente visuais e identificados por textos neutros, sem apresentar comparações inventadas como dados reais.
- Manter os indicadores de Experiência e Férias clicáveis, abrindo as listas atuais.

### 3. Barra de pesquisa e ações
- Montar uma única barra horizontal como na imagem, contendo:
  - busca por empresa, CNPJ, código SCI ou funcionário;
  - filtro **Status** da empresa;
  - filtro **Situação** dos funcionários;
  - botão de recarregar;
  - botão **Nova empresa**;
  - menu de três pontos.
- O menu de três pontos reunirá **Férias**, **Definir pasta** (somente admin) e o menu **Sincronizar** com Pasta, Experiência e Férias.
- **Nova empresa** abrirá o formulário completo já existente em Clientes por meio de um parâmetro de navegação, sem duplicar o cadastro.

### 4. Área de empresas
- Criar o cabeçalho **Empresas (quantidade)** com subtítulo, alternância funcional **Tabela / Cards** e botão **Exportar**.
- A visualização escolhida será mantida durante a sessão.
- A exportação gerará CSV em formato compatível com Excel, respeitando busca e filtros atuais.

### 5. Visualização em tabela
- Substituir a lista atual por uma tabela compacta igual à referência, com:
  - expansão;
  - código SCI e empresa;
  - CNPJ;
  - total de funcionários;
  - ativos;
  - desligados;
  - salários;
  - férias a vencer em 60 dias;
  - experiências a vencer em 15 dias;
  - status da empresa;
  - ações.
- Contadores serão apresentados em marcadores coloridos, e a tabela terá cabeçalho fixo visual, linhas densas e leitura rápida.
- Ao expandir uma empresa, preservar a tabela detalhada de funcionários, cadastro/edição/desligamento e expansão dos períodos de férias.

### 6. Visualização em cards
- Criar cards de empresa com os mesmos totais e alertas da tabela.
- Cada card poderá ser expandido para mostrar os funcionários e suas ações, preservando os mesmos recursos da visualização em tabela.

### 7. Comportamento e dados
- Carregar o status das empresas para alimentar o novo filtro e a coluna correspondente.
- Calcular salários, ativos, desligados, férias e experiências por empresa usando os dados já carregados.
- Preservar paginação, quantidade por página, sincronizações, diálogos, alertas e regras atuais.
- Não criar tabela, histórico artificial ou migração de banco.

## Arquivos previstos

- `src/pages/Personnel.tsx` — nova composição, filtros, tabela/cards, exportação e controles.
- `src/pages/Clients.tsx` — reconhecer o comando vindo de Pessoal e abrir o cadastro de nova empresa.
- `src/components/AppLayout.tsx` — somente se necessário para encaixar corretamente a largura da nova faixa superior sem alterar outras páginas.
- `src/index.css` e/ou tokens existentes — apenas ajustes semânticos indispensáveis ao acabamento da referência, mantendo tema claro/escuro.

## Validação

- Conferir desktop no tamanho da imagem e também celular, sem textos cortados ou controles sobrepostos.
- Testar busca, filtros, recarregar, nova empresa, menu de sincronização, Férias, Tabela/Cards, exportação e expansão das empresas/funcionários.
- Validar os totais por empresa contra os dados carregados.
- Executar testes de tipagem e confirmar o build limpo.
