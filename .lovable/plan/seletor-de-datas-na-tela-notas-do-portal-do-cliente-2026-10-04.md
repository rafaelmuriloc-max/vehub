# Seletor de datas na tela Notas do portal do cliente

## O que muda para o cliente
- No topo da tela Notas, um seletor de período com atalhos: **Este mês** (padrão), **Mês passado**, **Últimos 3 meses**, **Este ano** e **Personalizado**.
- Em **Personalizado** aparecem dois campos de data, **De** e **Até**, com calendário para escolher o dia.
- A lista, a quantidade e o valor total passam a mostrar só as notas do período escolhido, nas abas Emitidas e Recebidas.
- Funciona para qualquer data, inclusive notas com mais de 2 anos.
- No celular, o seletor e as datas ficam um embaixo do outro, ocupando a largura toda.

## Detalhes técnicos
- `src/pages/Portal.tsx`: `NotasView` recebe `clientId` e passa a buscar as notas (NF-e + NFC-e, `direction` saida/entrada) com `gte/lte issue_date` do período, recarregando quando o período ou a empresa mudam; mostra "Carregando..." durante a busca.
- Datas personalizadas com o Datepicker do shadcn (Popover + Calendar, `pointer-events-auto`, `ptBR`), validando De <= Até.
- O Dashboard continua usando o carregamento atual (faturamento por mês); nada muda no banco nem na segurança.
