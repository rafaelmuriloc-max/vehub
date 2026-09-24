# RBT12 vazia na Alecsandro Thiago Academia

## O que foi encontrado
- A sincronização de hoje (20:34) rodou para os 9 meses da empresa: gravou número da declaração, situação "Pago" e um PDF para cada mês — mas RBT12 e receita do ano ficaram vazias.
- O PDF guardado tem só ~5 KB e começa com a imagem do brasão: é o **recibo de entrega**, não a declaração completa. O recibo não traz RBT12.
- A Receita devolve os dois arquivos juntos (recibo e declaração). O sistema pega o primeiro PDF que encontra, que é o recibo.

## O que será feito
1. Na sincronização, escolher explicitamente o PDF da **declaração** (e não o do recibo) para ler RBT12 e receita acumulada no ano; o recibo continua guardado à parte, se útil.
2. Se a declaração completa não vier, buscar pelo serviço de consulta da declaração pelo número (já usado no botão "Declaração") e ler dele.
3. Registrar no log os nomes dos campos e o tamanho de cada PDF recebido, para confirmar na primeira rodada real.
4. Rodar a sincronização só da Alecsandro Thiago Academia e conferir no banco que a RBT12 foi preenchida antes de dar como resolvido.

## Detalhes técnicos
- `simples-nacional-sync/index.ts`: substituir `walkPdf` genérico por seleção `dadosDec.declaracao.pdf` (fallback: chave cujo `nomeArquivo` contenha "declara" e não "recibo"); fallback CONSDECLARACAO13 com `numeroDeclaracao`; depois `pdfText` + regex existentes.
- Deploy da função; verificação via consulta em `simples_nacional_competencias` do cliente 31.333.686/0001-66.
