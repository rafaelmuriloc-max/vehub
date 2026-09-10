# Controle de tempo e custo por cliente

Cronômetro (iniciar/parar) em tarefas e obrigações, com relatório de rentabilidade por cliente (horas × valor/hora vs honorário mensal).

## O que será construído

### 1. Cronômetro nas tarefas (Kanban/Lista)
- Botão ▶ Iniciar / ⏸ Parar no card da tarefa e no diálogo de edição.
- Enquanto roda, mostra o tempo decorrido ao vivo e quem está cronometrando.
- Cada sessão (início → parada) vira um registro; a tarefa pode ter várias sessões de vários usuários.
- Total acumulado da tarefa visível no card (ex.: `⏱ 1h25`).
- Só um cronômetro ativo por usuário: iniciar outro pausa o anterior automaticamente.

### 2. Cronômetro nas obrigações
- Mesmo play/stop na tela de execução da obrigação (ObligationExecutionDialog), por atividade ou pela instância como um todo.
- Total da instância exibido na lista/calendário.

### 3. Valor/hora por usuário
- Novo campo "Valor/hora (R$)" no cadastro de usuários (Configurações → Usuários), visível/editável só por admin.

### 4. Relatório de custo por cliente
- Nova aba "Custo por Cliente" (na página de Relatórios/Tarefas) com filtro de período (mês, trimestre, ano, personalizado) e departamento.
- Tabela: cliente (SCI + nome), horas de tarefas, horas de obrigações, horas totais, custo total (horas × valor/hora de quem executou), honorário mensal, resultado (honorário − custo) e margem %.
- Ordenação por custo, horas ou margem; destaque em vermelho para clientes com custo acima do honorário.
- Linha de detalhe expandível: quem executou, quantas horas e em quais tarefas/obrigações.
- Exportação em PDF.

## Detalhes técnicos

1. **Migration** — nova tabela `time_entries`:
   - `task_id` (nullable, FK tasks), `instance_id` (nullable, FK obligation_instances), `user_id`, `started_at`, `ended_at` (null enquanto roda), `duration_seconds` (calculado na parada), `notes`.
   - Índices por task/instance/user/data; GRANTs para `authenticated`/`service_role`; RLS: usuário vê/edita os próprios registros; admin vê todos.
   - Constraint: exatamente um de `task_id`/`instance_id` preenchido.
   - Coluna `hourly_rate numeric` em `profiles` (default null; RLS já existente de admin).
2. **Frontend**:
   - Hook `useTimeEntry` com realtime para refletir play/stop entre telas; decorrido calculado no cliente a partir de `started_at`.
   - `Tasks.tsx` / `TaskEditDialog.tsx` e diálogo de execução de obrigações: botões e totais via agregação de `time_entries`.
   - `UsersTab.tsx`: campo valor/hora (somente admin).
   - Novo componente de relatório agregando em memória (mesmo padrão do TasksRankingTab), usando `clients.monthly_value` como honorário.
3. Custo = Σ (duration_seconds/3600 × hourly_rate do usuário da sessão); sessões sem valor/hora contam horas mas entram no custo como 0, com aviso no relatório.
4. Sem edge functions; tudo via Supabase client + RLS.
