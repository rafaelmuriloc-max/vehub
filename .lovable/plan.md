# Área do Cliente totalmente responsiva

## O que muda (celular, tablet e computador)
- **Topo**: nome Velocitä + botão Sair compacto (só ícone no celular), respeitando a área do entalhe do iPhone.
- **Empresa e ano**: no celular ficam um abaixo do outro, em largura total; nome longo da empresa quebra linha sem estourar a tela. CNPJ e regime em linha própria.
- **Abas**: rolam para o lado no celular sem cortar texto; ficam fixas no topo ao rolar a página.
- **Faturamento**: cartões de total e quantidade lado a lado, com valores que diminuem a fonte se não couberem; gráfico mensal com valor que não fica cortado (coluna do valor encolhe no celular).
- **Notas emitidas e recebidas**: cada nota vira um cartão em duas linhas no celular (número/emitente em cima, data e valor embaixo); no computador continua em linha.
- **Guias**: mês e botões DAS/CCMEI empilhados em largura total no celular; lista do Simples com valor e botão de baixar alinhados sem empurrar o texto.
- **Avisos**: textos longos e links quebram linha corretamente.
- Botões e toques com no mínimo 44px de altura no celular; nenhuma rolagem lateral em telas de 320px.

## Detalhes técnicos
- Só `src/pages/Portal.tsx`; apenas tokens de cor existentes.
- `min-w-0`, `break-words`, `truncate` onde há texto variável; `overflow-x-hidden` no container.
- `TabsList` com `sticky top-14` e `overflow-x-auto` + `shrink-0` nos triggers.
- `NotasList`: `flex-col sm:flex-row`; gráfico mensal `w-16 sm:w-24` e `text-[11px] sm:text-xs`.
- Verificação com Playwright em 320, 375, 768 e 1280px (sem rolagem horizontal).
