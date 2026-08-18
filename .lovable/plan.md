# Download em lote dos relatórios de Situação Fiscal

## O que muda
Na página Fiscal > Situação Fiscal, adicionar um botão "Baixar PDFs" que gera um único arquivo ZIP com todos os relatórios já consultados.

## Comportamento
- Botão ao lado de "Consultar em Lote", no cabeçalho do card.
- Se houver clientes selecionados, baixa apenas os selecionados; caso contrário, baixa todos os clientes da lista filtrada.
- Só entram no ZIP clientes que já possuem PDF salvo. Os sem relatório são ignorados e informados no toast final (ex.: "12 PDFs baixados, 3 sem relatório").
- Botão desabilitado durante consultas (individual ou em lote) e quando não houver nenhum PDF disponível.
- Durante a compactação, spinner com contador de progresso.
- Nome de cada arquivo no ZIP: `SCI - Razao_Social.pdf`, com caracteres especiais sanitizados.
- Nome do ZIP: `Situacao_Fiscal_AAAA-MM-DD.zip`.

## Técnico
- Arquivo alterado: `src/components/integra-contador/SituacaoFiscalTab.tsx`.
- Usar `jszip` (já presente no projeto) para montar o pacote em memória a partir dos `pdf_base64` já carregados no estado e disparar o download via Blob + link temporário.
- Sem mudanças de banco de dados ou edge functions.