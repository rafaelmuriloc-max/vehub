# Gerar o PDF da NFS-e no layout oficial DANFSe v2.0

Hoje, quando o Portal Nacional está fora do ar (503), a função `nfse-download` gera um PDF-espelho simples, em formato de lista de campos — nada parecido com o DANFSe. O PDF passa a ser montado localmente a partir do XML oficial de cada nota, reproduzindo o layout do modelo enviado.

## O que será feito

Reescrever o gerador de PDF dentro de `supabase/functions/nfse-download/index.ts` para desenhar o DANFSe completo, em A4 retrato, com a mesma estrutura do modelo:

1. **Cabeçalho**: marca "NFS-e Nota Fiscal de Serviço eletrônica" à esquerda, "DANFSe v2.0 / Documento Auxiliar da NFS-e" ao centro, e Município / Ambiente Gerador / Tipo de Ambiente à direita.
2. **Bloco da chave**: chave de acesso, Número da NFS-e, Competência, Data e hora de emissão da NFS-e, Número/Série/Data da DPS, Emitente, Situação, Finalidade — e o QR Code à direita com o texto de autenticidade.
3. **Prestador / Fornecedor**: CNPJ, inscrição municipal, telefone, nome empresarial, município/UF, código IBGE/CEP, endereço, e-mail, opção pelo Simples Nacional e regime de apuração.
4. **Tomador / Adquirente**: mesmos campos.
5. Faixas centralizadas "DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e" e "INTERMEDIÁRIO…" quando esses grupos não existirem no XML.
6. **Serviço prestado**: código de tributação nacional/municipal, código NBS, local da prestação, descrição do serviço nacional e descrição livre.
7. **Tributação municipal (ISSQN)**: tipo de tributação, município de incidência, BC, alíquota, retenção, ISSQN apurado.
8. **Tributação federal**: IRRF, contribuição previdenciária retida, contribuições sociais retidas, PIS, COFINS.
9. **Tributação IBS/CBS**: CST/cClassTrib, indicador de operação, exclusões/reduções, alíquotas e valores apurados (IBS UF/Mun, CBS).
10. **Valor total da NFS-e**: valor da operação, descontos, total de retenções, valor líquido, total IBS/CBS, líquido + IBS/CBS — com fundo cinza como no modelo.
11. **Informações complementares** (`xInfComp`, quebrando por `|` e por largura) e a linha de tributos aproximados da Lei 12.741/2012.
12. **Rodapé**: caixa com Data de cientificação, Identificação e assinatura, e Nº NFS-e / Chave.

Campos ausentes no XML aparecem como `-`, exatamente como no modelo.

## Como o PDF passa a ser obtido

- O DANFSe oficial do Portal Nacional continua sendo tentado primeiro (é o documento com fé pública) e, quando responde, é o arquivo entregue e cacheado.
- Quando o portal falha (503/TLS/timeout), o PDF gerado localmente no layout acima é entregue no lugar do espelho atual — sem mensagem de erro para o usuário.
- O PDF gerado localmente continua não sendo cacheado como oficial: na próxima tentativa, se o portal voltar, o oficial substitui.

## Detalhes técnicos

- Renderização com `pdf-lib` (já usado no arquivo): grade de caixas com `drawRectangle` + `drawLine`, rótulos em Helvetica-Bold 5,5pt e valores em Helvetica 7pt, replicando as 4 colunas do modelo.
- QR Code: gerado no próprio Deno (`npm:qrcode`) apontando para a URL de consulta da chave no portal nacional, embutido como PNG.
- Leitura do XML: parser por regex já existente, estendido para navegar caminhos aninhados (`infNFSe`, `emit/enderNac`, `DPS/infDPS/toma`, `valores`, `IBSCBS`, `trib/totTrib`), tratando acentuação e escapes.
- Formatação pt-BR para moeda, percentual, CNPJ/CPF, CEP, telefone e datas.

## Fora do escopo

Nenhuma alteração de banco, de UI ou de outras integrações fiscais.
