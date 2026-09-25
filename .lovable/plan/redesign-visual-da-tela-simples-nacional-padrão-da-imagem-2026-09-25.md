# Redesign visual da tela Simples Nacional (padrão da imagem)

Somente visual. Regras, cálculos, consultas, botões e dados continuam iguais. Nenhum número inventado.

## O que muda na tela
1. **Título:** ícone de calculadora em quadrado laranja claro, "Simples Nacional" grande e o subtítulo atual.
2. **Barra de ações em uma linha:** busca larga ("Buscar por nome ou CNPJ da empresa..."), seletor de ano com ícone de calendário, "Sincronizar agora" (laranja), "Atualizar situação" e "Reprocessar fluxo" (brancos com borda). Mesmas funções e avisos de hoje; ícone gira enquanto roda.
3. **4 cartões:** Guias pagas (verde), Em aberto vencidas (vermelho), A vencer (neutro), % pagas (laranja), com ícone em círculo claro. Continuam clicáveis para filtrar. **Sem mini-gráficos nem "vs. ano anterior"**: o sistema só tem dados de 2026, então isso seria inventado.
4. **Gráfico "Guias por mês — {ano}"** (cerca de 2/3 da largura): barras agrupadas Jan–Dez, Pagas laranja, Em aberto vermelho, A vencer cinza-azulado, legenda embaixo, dica ao passar o mouse. Sem seletor "Visão", pois só existe a visão por quantidade.
5. **"Empresas com guias em aberto"** (1/3 à direita): linhas com ícone, código + nome (cortado com reticências e nome completo ao passar o mouse), meses em vermelho e seta. Botão **"Ver todas"** abre um painel lateral com a lista completa.
6. **Tabela "Empresas"** em cartão próprio: título com ícone, cabeçalho cinza claro, colunas Empresa, CNPJ, RBT12, Sublimite 3,6Mi, Sublimite 4,8Mi e menu "⋮". Barras de progresso finas (verde normal, âmbar perto do limite, vermelho acima, pelos critérios já existentes). Clicar na linha continua abrindo os meses da empresa. Paginação de 15 mantida, com visual novo.
   - A busca da tabela é a mesma busca do topo (não duplico campo).
   - **Sem botões "Filtros" e "Exportar"**, porque essas funções não existem hoje e o pedido proíbe botão sem ação. Se quiser, posso criar a exportação em CSV depois.
7. **Carregamento e vazio:** esqueletos cinza enquanto carrega; mensagem clara quando o ano não tem dados.
8. **Celular/tablet:** cartões em 2 colunas, gráfico e lista empilhados, tabela com rolagem lateral só dentro dela.

## Fica como está
- A navegação do topo (Situação Fiscal, Simples Nacional...) já existe na tela Fiscal; ganha só o formato em pílula com o ativo em laranja. Nada de novo cabeçalho, logotipo, sino ou avatar.
- Cores do sistema (laranja e azul-marinho da Velocitä) no lugar dos códigos de cor do documento, que são quase iguais.

## Técnico
- Arquivos: `SimplesNacionalTab.tsx` (título, barra, tabela, paginação), `SimplesDashboard.tsx` (cartões, gráfico, lista + Sheet "Ver todas"), `Fiscal.tsx` (botões em pílula).
- Tokens semânticos existentes (`primary`, `success`, `destructive`, `warning`, `muted`); nada de cores fixas.
- Sem mudanças no banco, nas funções do servidor ou na lógica de sincronização.
