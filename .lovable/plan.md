# Corrigir falha "Failed to send a request" na sincronização do Simples Nacional

## O que o log mostra
- Todas as consultas feitas pela rotina do Simples (pagamentos, última declaração, gerar DAS) falharam com "Failed to send a request to the Edge Function", para todas as empresas.
- As falhas aparecem a cada ~20 ms. Ou seja, nenhuma chamada chegou a ser processada: a consulta à Receita "liga" (booted) centenas de vezes, mas não registra nenhum pedido.
- A mesma consulta feita pelo botão da tela (Extrato) funcionou às 21:36, com resposta 200 da Receita. As credenciais e a procuração estão ok.
- Causa provável (ainda não confirmada): a rotina dispara centenas de chamadas internas em sequência, sem esperar nem limitar, e a plataforma deixa de entregá-las. O erro genérico esconde o motivo real.

## O que será feito
1. **Trocar a chamada interna por uma requisição direta** à consulta da Receita, registrando no log o código e o texto do erro, para o motivo real aparecer em vez de "Failed to send".
2. **Limitar o ritmo**: uma empresa por vez, com uma pequena pausa entre as chamadas e uma nova tentativa quando der erro de rede.
3. **"Atualizar situação" mais leve**: nesse modo, faz só 1 consulta de pagamentos por empresa, sem gerar DAS nem consultar declaração mês a mês (hoje são até 19 chamadas por empresa).
4. **Evitar que a tela estoure o tempo**: a tela manda as empresas em blocos (ex.: 10 por vez) e mostra o progresso até terminar.
5. Depois de publicar, verificar pelo log a primeira resposta real da consulta de pagamentos e ajustar a leitura, se precisar.

## Detalhes técnicos
- `simples-nacional-sync/index.ts`: substituir `supabase.functions.invoke` por `fetch(`${SUPABASE_URL}/functions/v1/integra-contador`)` com `Authorization: Bearer SERVICE_ROLE` e `apikey`; logar `status` + `body.slice(0,500)`; 1 tentativa extra em erro de rede; `sleep(300ms)` entre chamadas; aceitar `client_ids[]` e `offset/limit`, e devolver `next_offset`.
- `only_payments`: pula `syncCompetencia` (já é assim) e chama só PAGAMENTOS71.
- `SimplesNacionalTab.tsx`: loop por blocos com `offset` até `next_offset` ser nulo; toast final com o total de guias pagas e as empresas com erro.
- Deploy de `simples-nacional-sync`.
