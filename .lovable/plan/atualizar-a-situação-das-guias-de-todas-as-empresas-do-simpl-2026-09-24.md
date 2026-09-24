# Atualizar a situação das guias de todas as empresas do Simples

## O que será feito
Vou rodar daqui a mesma consulta do botão "Atualizar situação": para cada empresa ativa do Simples, pergunto à Receita quais DAS do ano foram pagos.

- Vou de 5 em 5 empresas, com pausa entre elas, para a Receita não recusar por excesso de pedidos.
- Meses com pagamento encontrado ficam "Pago", com a data. Meses que estavam "Pago" por engano e não têm pagamento voltam para "Em aberto".
- Os outros dados da guia (valor, PDF, declaração) não mudam.
- Nada é apagado.

## No fim
Aviso quantas guias pagas foram encontradas e listo as empresas que a Receita recusou (normalmente por falta do serviço de pagamentos na procuração).

## Detalhes técnicos
- Chamar `simples-nacional-sync` com `{ only_payments: true, year: 2026, offset, limit: 5 }` em sequência até `nextOffset` acabar.
- Conferir o resultado no banco (`simples_nacional_competencias` por status) e nos logs da função.
- Sem mudança de código.
