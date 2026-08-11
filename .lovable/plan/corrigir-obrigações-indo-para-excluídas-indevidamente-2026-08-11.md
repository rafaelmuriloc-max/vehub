# Corrigir obrigações indo para "Excluídas" indevidamente

## O que está acontecendo (confirmado)

A Pousada Safari Ltda está com cadastro correto (ativa, sem data de saída, 6 obrigações marcadas), mas todas as suas instâncias futuras — inclusive Folha de Pagamento Mensal 09/2026 — foram marcadas como excluídas no mesmo instante (05/08/2026 12:13).

Causa: ao salvar o cadastro de um cliente, o sistema **apaga todos os vínculos de obrigações** e depois insere de novo a lista inteira. O gatilho do banco que existe para excluir obrigações futuras quando uma obrigação é desmarcada dispara nesse apagão geral e derruba todas as instâncias futuras. A reinserção dos vínculos não desfaz a exclusão.

Impacto medido hoje: **794 instâncias de 102 clientes ativos** estão na aba "Excluídas" mesmo tendo o vínculo válido no cadastro.

## Correção

1. **Salvar por diferença**: no cadastro do cliente, remover somente os vínculos que o usuário realmente desmarcou e inserir apenas os novos. Vínculos que permaneceram marcados não são mais apagados/recriados — o gatilho deixa de disparar sem motivo.
2. **Restaurar ao (re)vincular**: gatilho no banco que, ao inserir um vínculo cliente/obrigação, reativa instâncias futuras que estavam excluídas para aquela combinação. Rede de segurança para qualquer outro caminho que apague e recrie vínculos.
3. **Reparo dos dados existentes**: restaurar as 794 instâncias não concluídas de clientes ativos, sem data de saída, que possuem vínculo válido no cadastro. Instâncias de clientes encerrados ou sem vínculo continuam excluídas.

## Detalhes técnicos

- `src/pages/Clients.tsx` (bloco "Sync obligation selections"): substituir `delete().eq('client_id', ...)` + insert completo por um diff contra os vínculos atuais (`delete().in('obligation_id', removidos)` e `insert(novos)`).
- Migração: função/gatilho `AFTER INSERT ON public.client_department_obligations` que faz `UPDATE obligation_instances SET deleted_at = NULL` para o par cliente/obrigação com `deleted_at IS NOT NULL` e vencimento/competência a partir de hoje.
- Migração de backfill: `UPDATE obligation_instances SET deleted_at = NULL` para instâncias `deleted_at IS NOT NULL`, `status <> 'done'`, cliente ativo e sem `end_date`, com vínculo existente em `client_department_obligations`.
- O gatilho de exclusão por `end_date` do cliente e o de desvinculação continuam como estão.
