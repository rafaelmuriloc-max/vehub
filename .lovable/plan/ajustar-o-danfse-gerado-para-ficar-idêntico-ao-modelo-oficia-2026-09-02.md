# Ajustar o DANFSe gerado para ficar idêntico ao modelo oficial

Comparei o PDF gerado (imagem enviada) com o DANFSe oficial de referência. A estrutura de seções já está correta, mas a aparência difere em vários pontos. O ajuste é só de renderização — nada de banco, XML ou integrações.

## Diferenças encontradas

1. **Logotipo**: o oficial usa a marca NFS-e (letras cinza-escuro com o "e" em círculo verde e o texto "Nota Fiscal de Serviço eletrônica" ao lado). O gerado desenha um "NFS" simples com círculo preto.
2. **Grade contínua**: no oficial o documento é uma única tabela sem espaços entre blocos; no gerado há folgas visíveis entre cabeçalho, identificação e prestador.
3. **Espessura das linhas**: oficial usa traço fino (hairline); o gerado usa bordas grossas, deixando o documento "pesado".
4. **Tamanho de fonte e altura de linha**: no oficial rótulos e valores são menores e as linhas mais compactas — cabem mais dados na mesma altura.
5. **Cabeçalho**: no oficial a faixa superior tem fundo levemente cinza e o município aparece como `Município: Cidade - UF` (hífen); no gerado está `Cidade / UF` e sem faixa.
6. **QR Code**: no oficial é menor, alinhado ao topo direito do bloco de identificação, com o texto de autenticidade logo abaixo dentro da mesma célula.
7. **Bloco de informações complementares**: no oficial ele se expande para preencher o espaço restante da folha, com o rodapé (DATA CIENTIFICAÇÃO / IDENTIFICAÇÃO E ASSINATURA / N° NFS-e-CHAVE) ancorado no rodapé da página. No gerado o rodapé vem logo após o texto, deixando a folha vazia embaixo.

## O que será feito

Tudo dentro de `supabase/functions/nfse-download/danfse.ts`:

- Redesenhar o cabeçalho: logo NFS-e vetorial (texto cinza-escuro + "e" branco sobre disco verde + subtítulo em duas linhas), título centralizado e bloco de município/ambiente à direita, com faixa de fundo cinza claro e formato `Município: X - UF`.
- Unificar todas as seções em uma grade contínua: uma borda externa única, sem folgas verticais entre blocos, divisórias internas simples.
- Reduzir espessura das linhas para hairline (0,5 pt) e ajustar tamanhos: rótulos ~5,5 pt em negrito, valores ~7,5 pt, títulos de seção ~7,5 pt em negrito; alturas de linha proporcionalmente menores.
- Reposicionar o QR Code (menor, canto superior direito do bloco de identificação) com as três linhas de autenticidade centralizadas abaixo dele.
- Calcular a altura do bloco "INFORMAÇÕES COMPLEMENTARES" para esticar até o rodapé, mantendo o rodapé fixo na base da página.
- Manter shading cinza claro apenas nas linhas de totais, como no modelo.

## Validação

Gerar o PDF localmente com um XML real, converter em imagem e comparar lado a lado com o PDF de referência, corrigindo até não restarem diferenças visuais relevantes. Em seguida, reimplantar a função `nfse-download`.
