# Corrigir a lista de obrigações que não carrega

## O que está acontecendo (verificado agora)

Nos registros da sua sessão, a chamada que traz as conclusões das obrigações do mês
(`get_calendar_month_completions`, período 01/07 a 01/09) voltou com erro
`57014 - canceling statement due to statement timeout`. Quando essa chamada falha, a
tela não avisa nada: o código ignora o erro e segue com a lista vazia — por isso a
lista "não carrega" e não aparece nenhuma mensagem.

Medi a consulta direto no banco (modo administrador, sem as regras de permissão):
588 ms, com leitura completa das duas tabelas. Com as regras de permissão por
departamento aplicadas linha a linha, o custo se multiplica e estoura o limite de tempo.

## O que será feito

1. **Tornar a consulta das conclusões rápida**
   - Reescrever a função no banco para primeiro selecionar as obrigações do período
     (usando os índices de competência e de vencimento, em vez de um `OU` que força
     leitura de tudo) e só depois buscar as conclusões desse conjunto.
   - Eliminar o `DISTINCT` desnecessário sobre todas as colunas.
   - A função passa a checar a permissão de departamento **uma vez por departamento**,
     e não uma vez por linha, mantendo exatamente a mesma visibilidade que o usuário já tem hoje.

2. **Fazer a tela avisar quando algo falha**
   - Na tela do Calendário, tratar o erro dessa chamada (e das demais do carregamento):
     mostrar um aviso "Não foi possível carregar as obrigações" com botão "Tentar novamente",
     em vez de exibir uma lista vazia silenciosamente.

3. **Conferir depois da mudança**
   - Reexecutar a consulta com medição e confirmar que o tempo cai para poucos milissegundos.
   - Abrir a tela do Calendário e confirmar que a lista aparece.

## Detalhes técnicos

- Migration: substituir `public.get_calendar_month_completions(p_start, p_end)` por uma
  versão com CTE `inst` (UNION de `reference_month` no período e `due_date` no período,
  ambos apoiados nos índices `idx_obligation_instances_status_ref_active` /
  `idx_obligation_instances_due_active`) e join com `obligation_activity_completions`
  por `instance_id` (índice `idx_obligation_activity_completions_instance`).
  Função `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, filtrando as instâncias
  pelos departamentos permitidos ao `auth.uid()` via `user_can_access_department`
  avaliado sobre a lista de departamentos (não por linha). Grants para `authenticated`.
- `src/pages/CalendarView.tsx`: capturar `error` de `supabase.rpc(...)` e dos três selects
  em `loadData`, guardar em estado `loadError`, exibir bloco de erro com botão de recarregar
  e `toast` destrutivo. Sem mudanças de layout no caminho de sucesso.
- Sem alterações de RLS das tabelas nem de dados.
