# Cards do Kanban de Tarefas iguais à referência

Ajustar apenas a aparência dos cartões na aba Kanban da tela Tarefas, sem mudar regras, filtros, paginação, cronômetro, anexos ou exclusão.

## O que muda no cartão

1. **Topo**: número da tarefa (#000398) em cinza à esquerda e selo de prioridade arredondado à direita.
2. **Título** em negrito, azul-marinho, logo abaixo.
3. **Cliente** em uma linha própria (ex.: "270 - FABIO GRECO DE CARVALHO") e **departamento** na linha seguinte (ex.: "Depto Fiscal"), ambos em cinza — hoje aparecem juntos separados por ponto.
4. **"Solicitado em ... por ..."** com ícone de calendário, em cinza, menor.
5. **"Concluído em ..."** em verde com ícone de confirmação (só nas concluídas).
6. **Responsáveis**: pílula colorida com círculo de iniciais e nome, sem o rótulo "Atribuído:" que existe hoje.
7. **"Prazo: dd/mm/aaaa"** em vermelho/laranja com ícone de calendário.
8. **Rodapé** separado por linha fina: à esquerda o cronômetro (ícone play laranja + tempo) e os contadores de anexos; à direita "Para o cliente" em laranja e o ícone de lixeira vermelho.
9. **Remover os botões "→ A Fazer / → Aguardando"** de dentro do cartão, que não existem na referência. A movimentação de status continua disponível ao abrir a tarefa.
10. Espaçamento interno mais compacto e borda leve, como na imagem.

## O que não muda

- Destaque verde para tarefas concluídas no prazo.
- Ordenação por vencimento na coluna "A Fazer", paginação de 10 cards, cabeçalhos das colunas e estados vazios.
- Nenhuma alteração de banco de dados, consultas ou permissões.

## Detalhes técnicos

- Arquivo único: `src/pages/Tasks.tsx` (bloco do `<Card>` do Kanban, linhas ~703-774).
- Usar tokens semânticos existentes (`text-foreground`, `text-muted-foreground`, `text-primary`, `text-destructive`, verdes já usados) — sem cores literais novas.
- `AssigneeBadge` ganha o círculo de iniciais; caso precise, ajustar o componente auxiliar já existente no arquivo.
- Validação: `tsgo`/build e conferência visual no preview.

## Ponto a confirmar

A remoção dos botões de mover status dentro do cartão está de acordo? Se preferir mantê-los, basta dizer e eles ficam.
