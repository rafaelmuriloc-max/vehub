# Correção: NFC-e aceitas mas sem notas (Pizzaria Baú do Tesouro e outras 88)

## Causa encontrada
Na busca, o sistema manda para a SEFAZ-SC um filtro chamado "papel da empresa na nota". Hoje ele vai com o valor **9**, que o manual (Boletim Técnico SC-2026/003, campo `indAtor`) define como "a empresa é emitente **E** também destinatária da mesma nota". Nenhum cupom de venda ao consumidor se encaixa nisso. Por isso a SEFAZ respondeu "Nenhum documento localizado" para a pizzaria e para as outras 88 empresas aceitas.

O valor copiado foi o do exemplo do manual, que usa justamente o 9.

## O que vou mudar
1. O filtro passa a ser **3 = emitente OU destinatário**. Assim vêm os cupons que a empresa emitiu e também os que ela recebeu.
2. Por causa do erro, as 89 empresas aceitas ficaram com a próxima busca travada por 12h. Vou liberar a trava delas e voltar o ponto de leitura para 0. As 112 recusadas não mudam.
3. Depois disso, a busca pode ser feita na hora pela tela Notas Fiscais → NFC-e → Sincronizar.

## Detalhes técnicos
- `supabase/functions/nfce-query/index.ts`, `buildSoapRequest`: `<indAtor>9</indAtor>` passa a ser `<indAtor>3</indAtor>`. Deploy da função.
- Liberação das 89 empresas: `update clients set nfce_next_query_at = null, last_nfce_nsu = '0' where nfce_next_query_at > now()`. Só atinge as empresas travadas pela busca de hoje, porque as recusadas nunca recebem trava.
- Antes de reprocessar todas, testo com a Pizzaria (CNPJ 53.990.547/0001-48). Pelos registros, confirmo que a resposta é 118 com documentos no lote e não 117.
