# Parcelamentos RFB: lista de empresas expansível

## O que muda na tela
- A tabela atual (uma linha por parcelamento) vira uma **lista de empresas**, 15 por página, mantendo os 4 cartões, busca (nome, código SCI, CNPJ), filtros e consulta em lote.
- Cada empresa mostra no resumo: código SCI + nome, CNPJ, quantidade de parcelamentos ativos, total parcelado, data da última consulta e selo de situação (Com parcelamento / Sem parcelamentos / Não consultada / Erro).
- **Clicando na empresa**, ela expande e mostra os parcelamentos **agrupados por categoria** (Ordinário SN, Especial SN, PERT-SN, RELP-SN, Ordinário MEI, Especial MEI, PERT-MEI, RELP-MEI). Só aparecem as categorias em que a empresa tem parcelamento.
- Cada parcelamento mostra: número, situação, data do pedido, valor total, parcelas pagas/total, e três botões:
  - **Atualizar**: consulta de novo só aquela categoria na Receita e atualiza o registro.
  - **Gerar parcela**: busca as parcelas disponíveis; se houver uma só, gera o DAS direto; se houver várias, abre uma pequena escolha (padrão: a do mês atual). O PDF é baixado e fica guardado para o botão Enviar.
  - **Enviar**: gera (ou reaproveita) a guia da parcela e abre uma janela com a mensagem pronta e editável, enviando o PDF + mensagem no WhatsApp da empresa (contato principal do cliente). Mostra aviso se a empresa não tiver WhatsApp.
- Parcelamentos encerrados/liquidados aparecem esmaecidos, com Gerar e Enviar desativados.
- O botão de "detalhes" com a resposta bruta continua disponível dentro do parcelamento.
- No celular, os botões ficam empilhados em largura total.

## Detalhes técnicos
- Arquivo principal: `src/components/integra-contador/RfbParcelamentos.tsx` (reorganizado em componentes internos: linha de empresa com Collapsible, grupo por categoria, cartão de parcelamento).
- Atualizar por categoria: chama `integra-contador` com o `PEDIDOSPARC*` da modalidade, apaga só as linhas daquele `client_id + modalidade` em `parcelamento_results` e insere as novas.
- Gerar: `PARCELASPARAGERAR*` e `GERARDAS*` (mapa `PARCELAS_SERVICES` existente); PDF extraído de `docArrecadacaoPdfB64` com fallback na busca recursiva `JVBERi0`.
- Enviar: telefone de `clients.contact_phone`/`whatsapp`; envio do PDF pela função de mídia do WhatsApp já usada no chat (`whatsapp-send-media`) seguida do texto via `whatsapp-send`, registrando na conversa do cliente.
- Sem mudanças no banco. Paginação passa a contar empresas, não linhas.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json`.
