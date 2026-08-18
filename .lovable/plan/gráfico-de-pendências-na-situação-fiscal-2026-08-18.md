# Gráfico de pendências na Situação Fiscal

Adicionar, no topo da seção de consulta da Situação Fiscal, um painel de visão geral com dois gráficos de rosca e cartões de totais.

## Painel 1 — Situação geral
- Donut com as fatias: Regular (verde), Irregular (vermelho), Erro (laranja), Pendente/nunca consultado (cinza).
- Ao lado, cartões com o total de clientes e o número/percentual de cada situação.
- Clicar em uma fatia ou cartão aplica o filtro correspondente na tabela abaixo.

## Painel 2 — Tipos de pendência
- Donut apenas dos clientes irregulares, agrupado por tipo de pendência detectado no relatório: Débitos, Omissão de declaração, Parcelamento, Inscrição em dívida ativa, Processo/exigibilidade suspensa, Outros.
- Um cliente pode aparecer em mais de uma categoria; o gráfico conta ocorrências e o rótulo deixa isso claro.
- Cartões ao lado listam cada tipo com a contagem de clientes afetados.

## Como os tipos de pendência são obtidos
- O texto de cada relatório já é extraído no navegador com pdf.js durante a consulta. Esse texto passa a ser classificado por palavras-chave em categorias e o resultado é salvo junto ao registro do cliente, para o gráfico não precisar reprocessar PDFs a cada carregamento.
- Para os clientes já consultados antes desta mudança, o texto é reprocessado sob demanda a partir do PDF armazenado na primeira vez que o painel carregar, e o resultado é gravado.

## Comportamento
- O painel respeita a busca e o filtro de situação ativos, refletindo o mesmo conjunto exibido na tabela.
- Enquanto os dados carregam, mostra esqueleto de carregamento; sem clientes, mostra estado vazio.
- Layout responsivo: os dois painéis lado a lado no desktop e empilhados no mobile.

## Técnico
- Alterações em `src/components/integra-contador/SituacaoFiscalTab.tsx` e um novo componente de painel em `src/components/integra-contador/SitfisOverviewPanel.tsx`.
- Gráficos com `recharts` (PieChart em modo donut), cores vindas dos tokens do design system.
- Migração no banco: nova coluna `pendency_types` (text[]) em `sitfis_results`, preenchida pela classificação por palavras-chave.