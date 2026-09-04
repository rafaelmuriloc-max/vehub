# Verificação de datas de vencimento das obrigações

Levantamento feito sobre todas as tarefas futuras. Foram encontrados três casos, sendo um idêntico ao do DAS.

## 1. Vencimento caindo no domingo 20 (mesmo problema do DAS)

| Obrigação | 20/09/2026 | 20/12/2026 |
|---|---|---|
| Darf Previdenciário | 51 empresas | 51 empresas |
| FGTS | 35 empresas | 35 empresas |

Nas mesmas competências, parte das empresas já está corretamente em 18/09 e 18/12 (Darf 22, FGTS 20), então a base está dividida.

Correção: mover essas tarefas de 20/09 para 18/09 e de 20/12 para 18/12 (sexta-feira anterior).

Nenhuma outra tarefa futura cai em sábado ou domingo, e nenhuma cai em feriado nacional (12/10, 02/11, 15/11, 25/12).

## 2. MIT com vencimento divergente do cadastro

A obrigação MIT está cadastrada com vencimento no dia 25, mas 66 empresas por mês estão com datas bem diferentes (14/08, 15/09, 15/10, 13/11, 15/12), enquanto apenas 3 empresas seguem o dia 25.

Isso não é problema de fim de semana e sim de datas gravadas fora da regra. Antes de mexer, confirmar qual é o vencimento correto do MIT: dia 25 (como no cadastro) ou dia 15.

## 3. Adto Salarial sem data de vencimento

Cerca de 12 empresas por mês (ago a dez/2026) estão com a tarefa de Adto Salarial sem nenhuma data de vencimento preenchida, enquanto 4 têm a data normal. Podem ser ajustadas para o dia 20 com antecipação, se desejado.

## O que será feito nesta etapa

Corrigir apenas o item 1 (Darf Previdenciário e FGTS em 18/09 e 18/12), e confirmar com você os itens 2 e 3 antes de qualquer alteração.

## Detalhes técnicos

- Atualização em `obligation_instances` para `obligation_id` de Darf Previdenciário e FGTS, com `due_date in ('2026-09-20','2026-12-20')` e `deleted_at is null`, subtraindo 2 dias.
- Conferência posterior por competência para validar as contagens consolidadas (73 e 55 por mês).
