# Buscar a RBT12 de todas as empresas do Simples

## O que será feito
Vou rodar daqui a sincronização completa do Simples, uma empresa por vez, só para os meses de 2026 que ainda estão sem RBT12.

- Primeiro confiro quantas empresas e meses ainda faltam (parte já foi feita na rodada anterior).
- Retomo de onde parou, pulando os meses que já têm RBT12.
- A situação "Pago" e os outros dados já corretos não são apagados.
- Nada é excluído do banco.
- Se a rodada parar no meio, eu retomo até terminar ou até o limite desta conversa.

## No fim
Informo:
- quantas empresas e meses ficaram com RBT12;
- quantos ainda faltam e por quê (mês sem declaração enviada ou empresa recusada pela Receita, como a DUFARMA).

Leva algumas horas: cerca de 2 minutos e meio por empresa.

## Detalhes técnicos
- Contagem inicial em `simples_nacional_competencias` (ano 2026, meses 1–8, `rbt12 is null`) por cliente ativo do Simples.
- Chamar `simples-nacional-sync` com `{ year: 2026, only_missing: true, offset, limit: 1 }` em sequência até `nextOffset` acabar; repetir para empresas que falharem por tempo esgotado.
- Sem mudança de código.
