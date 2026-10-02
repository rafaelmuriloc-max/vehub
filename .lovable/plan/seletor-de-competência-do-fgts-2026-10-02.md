# Seletor de competência do FGTS

## Problema
O campo de mês na tela FGTS usa o seletor de mês do próprio navegador. Em navegadores como Firefox e Safari, esse seletor não abre e fica sem opção de troca.

## Solução
- Trocar o campo por um seletor próprio do sistema, que funciona em qualquer navegador:
  - botão **<** para ir ao mês anterior;
  - lista com os meses (Janeiro a Dezembro) e lista com os anos (de 2024 até o ano atual);
  - botão **>** para ir ao próximo mês.
- Ao trocar o mês, a lista e os cartões recarregam como hoje. O padrão continua sendo o mês anterior ao atual.

## Detalhes técnicos
- Arquivo: `src/pages/FgtsDigital.tsx`. Trocar `<Input type="month">` por dois `Select` (mês e ano) mais dois botões com `ChevronLeft` e `ChevronRight`.
- O estado `comp` continua no formato `AAAA-MM`. Nenhuma mudança na consulta.
