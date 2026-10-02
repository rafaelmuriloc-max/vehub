# Guia do MEI no "Recalcular guia" do Chat

## O que será feito
- Na janela "Recalcular guia", o campo **Tipo de guia** ganha a opção **MEI (DAS MEI)**.
- Se a empresa da conversa for MEI, essa opção já vem marcada. As empresas Simples continuam vindo com "Simples Nacional", e as demais com "DCTFWeb".
- Para o MEI, escolhe-se mês e ano e clica em **Gerar guia**. A Receita emite o DAS MEI atualizado até hoje.
- A mensagem para o cliente já vem pronta, por exemplo: "Olá! Segue a guia do MEI (DAS MEI) da competência 09/2026 da empresa X, recalculada com juros e multa até hoje...".
- O envio no chat, o download e a opção "Gerar de novo" funcionam como hoje.

## Detalhes técnicos
- Só `src/components/chat/RecalcGuiaDialog.tsx`.
- `Tipo = 'simples' | 'dctfweb' | 'mei'`. Tipo inicial definido por `tax_regime` sem diferenciar maiúsculas: "mei" → `mei`; contém "simples" → `simples`; senão `dctfweb`.
- Para o MEI, a chamada é `integra-contador` com `PGMEI / GERARDASPDF21`, tipo Emitir e `dados = { periodoApuracao: 'AAAAMM' }`. O PDF sai pela mesma busca recursiva já usada.
- Arquivo `Guia_DAS_MEI_AAAAMM_EMPRESA.pdf`; rótulo do cartão "DAS – MEI".
- Sem mudança no banco nem nas funções do servidor.
