# Detalhar pendências ao clicar no gráfico

Hoje o painel "Tipos de pendência" é apenas informativo. Passa a ser clicável: ao clicar em uma fatia do gráfico ou em um cartão de tipo, abre um diálogo com os clientes daquele tipo e o trecho do relatório que gerou a classificação.

## Comportamento

- Clique na fatia do donut ou no cartão do tipo (ex.: "Débitos") abre um diálogo com o título do tipo e a contagem de clientes.
- Lista de clientes: código SCI + nome da empresa, CNPJ, data da consulta e um badge com os demais tipos de pendência do cliente.
- Para cada cliente, o trecho do relatório que menciona a pendência (as linhas onde as palavras-chave daquele tipo aparecem, até 3 trechos, com destaque no termo encontrado).
- Quando o trecho não puder ser obtido (sem PDF salvo), mostra "Descrição não disponível — refaça a consulta".
- Cada linha tem botões "Ver PDF" e "Baixar PDF", reaproveitando as ações já existentes na tabela.
- Diálogo responsivo, com rolagem interna; no mobile ocupa quase toda a tela.

## De onde vem a descrição

- O texto dos relatórios não é armazenado, apenas as categorias. O trecho é extraído sob demanda do PDF já carregado em memória (`pdf_base64`) com pdf.js, na abertura do diálogo, com indicador de carregamento por cliente.
- A extração usa as mesmas palavras-chave da classificação, recortando a linha do texto onde o termo aparece.

## Técnico

- `SitfisOverviewPanel.tsx`: tornar as fatias/cartões clicáveis (`onClick` no `Pie`/`Cell` e nos cartões) e emitir `onSelectPendency(key)`; exportar as regras de palavras-chave e uma função `extractPendencyExcerpts(text, key)`.
- `SituacaoFiscalTab.tsx`: novo estado `pendencyDetail` e um `Dialog` que filtra `clients` por `pendency_types.includes(key)` e chama a extração de trechos por cliente (reutiliza `extractTextFromPdfBase64`, com cache em memória por client_id).
- Sem alterações de banco.
