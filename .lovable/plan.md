# Corrigir vencimento do DAS - Simples Nacional (set/2026 e dez/2026)

## O que foi encontrado

O DAS está cadastrado com vencimento no dia 20. Nas competências em que o dia 20 cai no domingo, parte das empresas ficou com a data antecipada e parte não:

- Competência 09/2026: 51 empresas em 18/09 (correto) e 82 empresas em 20/09 (domingo)
- Competência 12/2026: 51 empresas em 18/12 (correto) e 82 empresas em 20/12 (domingo)

Os demais meses (07, 08, 10, 11) caem em dia útil e estão corretos.

## Correção

Ajustar as tarefas do DAS que estão em domingo para a sexta-feira anterior:

- 20/09/2026 → 18/09/2026 (82 tarefas)
- 20/12/2026 → 18/12/2026 (82 tarefas)

Nenhuma outra obrigação, competência anterior ou tela é alterada.

## Detalhes técnicos

- Atualização de dados em `obligation_instances` filtrando `obligation_id = cd5bf067-4a29-43e9-8d78-49f916b8f1d4`, `due_date in ('2026-09-20','2026-12-20')` e `deleted_at is null`.
- Depois da atualização, conferir a contagem por competência para garantir 133 tarefas em 18/09 e 133 em 18/12.
- A geração futura já usa `due_day = 20` com antecipação para dia útil; o caso corrigido é de registros criados antes dessa regra.
