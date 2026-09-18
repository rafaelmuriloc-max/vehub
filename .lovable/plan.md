# Novo visual do calendário

Muda apenas o bloco do calendário (o cartão com a grade do mês). Tudo o que está acima (saudação, cartões coloridos, gráficos de desempenho e filtros) e a lista de obrigações do dia ao lado continuam como estão hoje.

## O que muda

Cabeçalho do cartão do calendário
- Título "Calendário" grande à esquerda, com a frase "Suas obrigações fiscais e administrativas, em um só lugar." abaixo.
- No centro, a navegação de mês: seta anterior, "Setembro 2026", seta seguinte, e um botão "Hoje" que volta para o mês atual.

Faixa de resumo (nova, logo abaixo do cabeçalho)
- Três indicadores com ícone em quadrado colorido: total de obrigações no mês, urgentes com prazo próximo e concluídas no mês — calculados a partir dos dados já carregados do mês.
- À direita, a legenda em bolinhas: Urgente / Atrasada (vermelho), Pendente (laranja), Concluída (verde). Substitui a legenda atual do rodapé (Alerta / Meta / Vencimento / Tarefa).

Grade dos dias
- Cabeçalho dos dias em maiúsculas: DOM, SEG, TER, QUA, QUI, SEX, SÁB.
- Cada dia vira um cartão branco com borda suave e cantos arredondados; sábados e domingos com fundo levemente acinzentado; dias vazios do mês continuam em branco.
- Número do dia no canto superior esquerdo. O dia de hoje ganha o número em um círculo azul e o cartão com destaque azul claro e borda azul.
- Feriados mostram um ícone de calendário com o nome do feriado e a linha "Feriado nacional".
- Cada obrigação aparece como uma pílula colorida de largura total: bolinha de status + nome à esquerda e a quantidade à direita, com fundo suave na cor do status (vermelho para atrasada/urgente, laranja para pendente, verde para concluída).
- Continuam até 3 itens visíveis, com o link "+N mais" em azul, e a pílula "Tarefas" (laranja) sempre por último.
- Clicar no dia continua abrindo as obrigações daquele dia na lista lateral.

## Detalhes técnicos

- Arquivo único: `src/pages/CalendarView.tsx`, trecho do `Card` do calendário (aprox. linhas 1424–1526).
- Cores vindas dos tokens já existentes (`calendar-blue`, `calendar-red`, `calendar-orange`, `calendar-green`); nada de cor fixa em componente.
- A cor de cada pílula passa a derivar do status agregado do item (atrasada/pendente/concluída) em vez dos tipos atuais alerta/meta/vencimento, usando `localDateKey` para comparar datas no fuso de São Paulo.
- Mobile mantém a versão compacta com bolinhas; o novo layout de pílulas vale do breakpoint md para cima.
- Sem alteração de banco, consultas, filtros ou regras de negócio.
- Validação com `bunx tsgo --noEmit` e `bun run build`.
