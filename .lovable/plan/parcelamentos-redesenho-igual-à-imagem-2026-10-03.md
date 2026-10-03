# Parcelamentos: redesenho igual à imagem

## O que muda na tela
- **Topo**: trilha "Fiscal > Parcelamentos", título grande "Parcelamentos" e subtítulo. À direita, um quadro com "Última atualização em lote" (data e hora) e o botão azul **Atualizar todas**.
- **5 cartões coloridos** em uma linha: Empresas monitoradas (azul), Com parcelamentos ativos (verde), Parcelas em atraso (laranja), Parcelamentos rescindidos (vermelho), Vencem nos próximos 7 dias (roxo). Cada um tem ícone em círculo e número grande.
- **Abas** "RFB (Receita Federal)" e "PGFN (Dívida Ativa da União)" no estilo de abas com ícone, como na imagem.
- **Barra de filtros**: Todas as situações, Todas as origens, busca (nome, CNPJ ou número do parcelamento), botão azul **Consultar selecionados** e **Exportar**.
- **Empresa (cartão)**: caixa de seleção, seta para abrir/fechar, ícone de prédio, "código • NOME", CNPJ embaixo; selo "Com parcelamento" (verde, ou amarelo quando tem atraso); à direita "X ativos • valor total", "Consultado em data", botão **Atualizar** e menu de três pontos.
- **Ao abrir**: faixas de grupo coloridas ("Receita Federal" em azul, "MEI" em verde). Cada parcelamento vira uma linha com selo "Ativo", etiqueta da modalidade (SIMPLES NACIONAL, RELP-SN, PARCMEI), origem e nº; colunas Situação, Data do pedido, Valor consolidado, Parcelas (pagas/total), Valor da parcela e Próximo vencimento (com ícone de calendário); seta à direita. Embaixo, quatro botões em linha: Atualizar, Gerar parcela, Enviar via WhatsApp (verde) e Detalhes.
- Os detalhes (incluindo as parcelas pagas), a geração da guia e o envio por WhatsApp continuam funcionando como hoje.
- No celular, os cartões e colunas se empilham.

## O que pode faltar
- "Parcelas em atraso", "Vencem nos próximos 7 dias" e "Próximo vencimento" são calculados pelo mês atual e pelas parcelas pagas/total quando o dado da Receita não vier pronto. Se não houver base, mostra "—".
- "Última atualização em lote" usa a consulta mais recente registrada.

## Detalhes técnicos
- Arquivos: `src/components/integra-contador/ParcelamentosTab.tsx` (cabeçalho, cartões e abas) e `src/components/integra-contador/RfbParcelamentos.tsx` (filtros, cartão de empresa, faixas de grupo e linha do parcelamento). Os cartões de resumo saem do componente RFB e passam a receber os números dele.
- Cores só por tokens semânticos (adicionar em `index.css` e no Tailwind os tons info, success, warning, danger e violet, com versões suaves, se faltarem).
- Valor da parcela: `parcelaBasica` do OBTERPARC quando houver, senão valor consolidado / total de parcelas.
- O banco e as funções do servidor não mudam.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json` e captura de tela comparando com a imagem.
