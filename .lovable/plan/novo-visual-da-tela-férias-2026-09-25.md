# Novo visual da tela Férias

A tela Férias ganha o visual da imagem. Todos os números continuam vindo dos seus dados. As regras de cálculo e a sincronização com o SCI continuam iguais.

## O que você vai ver
- **Topo:** seta de voltar para Pessoal, o caminho "Departamento pessoal / Férias", o título "Gestão de férias", o subtítulo e o botão laranja "Sincronizar férias". O botão gira e fica travado enquanto sincroniza, e depois avisa se deu certo ou se deu erro.
- **Filtros:** empresa (dá para digitar para buscar, com "Todas as empresas"), data de referência e horizonte (30, 60 ou 90 dias). À direita aparece "X colaboradores · Y empresas".
- **4 cartões:** colaboradores com férias vencidas, dias de férias vencidas e empresas com pendências, os três em vermelho suave. O quarto mostra os próximos vencimentos em azul suave, por exemplo "2 colaboradores — nos próximos 30 dias". Os cartões continuam abrindo a lista de quem entra naquele número.
- **Composição do saldo:** uma barra única que substitui o gráfico de pizza. Ela divide o saldo em vencidas, adquiridas no prazo e em formação, com dias e percentual de cada parte, e mostra o total de dias à direita.
- **Dois gráficos lado a lado:**
  - "Vencimentos por mês": barras laranja com os dias que vencem em cada um dos próximos 12 meses.
  - "Dias vencidos por empresa": barras vermelhas mostrando as 5 maiores, com a opção "Ver todas". A troca de medida que já existe continua. Clicar numa empresa filtra a tela e aparece um botão para limpar.
- **Tabela "Férias por colaborador":**
  - Busca, filtro de situação e ordenação, com o número de resultados.
  - Colunas: iniciais e nome (com a empresa e o código embaixo), vencidas, adquiridas, em formação, saldo e prazo.
  - Quando o prazo já passou, aparece "Prazo ultrapassado" em vermelho.
  - Um menu "⋮" abre o detalhe de cada período, como hoje.
  - A tabela é paginada e os totais consideram todos os registros, não só a página aberta.
- Os 4 cartões ficam em linha no computador e em 2 ou 1 coluna em telas menores.

## O que não muda
- Nada muda no banco, na sincronização nem nas regras de vencido, adquirido e em formação.
- Empresas inativas continuam fora da tela.
- O menu lateral fica como está. Não vou criar os módulos extras nem o usuário fictício que aparecem na imagem.

## Técnico
- As mudanças ficam só em `src/pages/Vacations.tsx`, reaproveitando `src/lib/vacations.ts`, `ClientCombobox`, Recharts, Sheet e Dialog.
- As cores seguem os tokens já usados na Folha (pr-*), com modo escuro. Os números usam `tabular-nums`, com vírgula pt-BR.
- A validação é feita com `bunx tsgo --noEmit` e com o build.
