# Certificados vencidos na lista de Vencimento de Certificados

## Problema confirmado

O painel "Vencimento de Certificados" (página Clientes) só lista certificados cujo vencimento cai dentro do mês selecionado. Hoje existem 12 clientes ativos com certificado já vencido, e nenhum deles venceu no mês corrente — por isso nenhum aparece na lista, e o contador "Vencidos" mostra 0.

## O que muda

- A lista passa a mostrar sempre, no topo, todos os certificados já vencidos (de qualquer mês anterior), seguidos dos certificados que vencem no mês navegado.
- O contador "Vencidos" passa a refletir o total real de vencidos (12 hoje), independentemente do mês selecionado.
- Ordenação: vencidos primeiro (do mais antigo para o mais recente), depois os do mês.
- Um separador discreto "Vencidos" / "Vence em <mês>" divide os dois grupos, para não confundir com a navegação por mês.
- Quando não houver nem vencidos nem vencimentos no mês, mantém a mensagem atual de lista vazia.

## Detalhes técnicos

`src/pages/Clients.tsx`
- No `useMemo` `certMonthData` (≈ linhas 238-261): calcular dois conjuntos — `expiredList` (todos com `digital_certificate_expiry < hoje`) e `monthList` (vencimento dentro do mês selecionado e ainda não vencido). Retornar `clients: [...expiredList, ...monthList]`, `expired: expiredList.length`, `soon` contando os próximos 15 dias sobre o conjunto exibido e `total` o tamanho combinado.
- Na tabela (≈ linhas 1424-1457): renderizar as linhas dos dois grupos com uma linha de cabeçalho de grupo entre eles; badge "Vencido" permanece igual para o primeiro grupo.
