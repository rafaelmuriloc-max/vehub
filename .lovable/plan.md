# Ajustar os medidores dos departamentos ao layout de referência

Deixar o bloco "Desempenho geral dos departamentos" igual à imagem enviada, sem mexer no calendário, filtros, cálculos ou dados.

## O que muda

1. **Cada departamento vira um cartão próprio**
   - Fundo branco, borda cinza clara, cantos levemente arredondados e espaçamento igual entre eles.
   - Sai a linha divisória vertical que hoje separa os medidores.
   - Os cartões dividem a largura disponível em partes iguais, com rolagem lateral em telas estreitas.

2. **Medidor igual ao modelo**
   - Arco grosso com pontas arredondadas e degradê vermelho → laranja → amarelo → verde.
   - Trilho de fundo bem claro atrás do arco.
   - Ponteiro preto curto, com base grossa e ponta fina, e círculo preto no eixo, posicionado acima do número sem encobri-lo.
   - Percentual em preto/azul-marinho, grande e centralizado dentro do arco, alinhado à base.

3. **Textos abaixo do medidor**
   - Nome do departamento em negrito azul-marinho logo abaixo do número.
   - Linha de comparação "▲ +X% vs. mês anterior" em verde (ou vermelho quando negativo) na base do cartão, com um leve espaçamento maior.

4. **Cabeçalho da seção**
   - Mantido: ícone laranja de barras, título e subtítulo, além do seletor de mês.

## Detalhes técnicos

- Arquivo único: `src/pages/CalendarView.tsx`.
- `DepartmentGauge` recebe o contêiner em formato de cartão (`rounded-md border bg-card`) e os ajustes de tipografia/espaçamento.
- `GaugeArc` recebe ajuste fino de proporção do ponteiro e do hub para replicar o modelo; o medidor geral continua usando o mesmo componente e mantém o visual atual.
- Nenhuma alteração em consultas, banco de dados ou lógica de desempenho.
