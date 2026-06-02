## Dashboard TV — Painel de operação

Página fullscreen pensada para ficar exposta numa TV no escritório, com auto-refresh e visual de alto contraste.

### Acesso e navegação
- Nova rota `/dashboard` protegida (somente admin), acessível pelo menu lateral com ícone `MonitorPlay`.
- Layout dedicado: ocupa 100dvh, sem padding do AppLayout (similar ao tratamento do `/chat`), com header próprio mostrando logo + relógio + data.
- Auto-refresh dos dados a cada 30s (React Query `refetchInterval`) + realtime nos canais já existentes (`chat_messages`, `chat_conversations`).

### Seções (grid responsivo)

**1. Clientes**
- Card grande: Ativos vs Inativos (contagem de `clients` por `status`).
- Card: Novos no mês (clients com `start_date` no mês corrente).
- Card: Churn no mês (clients com `end_date` no mês corrente).

**2. Tarefas (obligation_instances)**
- Donut/contadores por status (pending / in_progress / done) do mês corrente.
- Destaque vermelho: Atrasadas (due_date < hoje && status != done).
- Contador grande: Concluídas hoje.
- Ranking top-5 colaboradores por conclusões hoje + na semana (join `obligation_activity_completions` → `profiles`, com tag_color).

**3. Obrigações**
- Lista das próximas 7 dias: nome da obrigação + cliente + vencimento + atendente (limit 10, scroll suave).
- Barra de % conclusão do mês por departamento.

**4. Chamados (chat)**
- Card: Aguardando 1ª resposta (`awaiting_first_reply = true`) com tempo de espera.
- Lista: Chamados abertos por atendente (group by `assigned_to`, contagem + tag colorida).
- Destaque para chamados sem atribuição (`assigned_to IS NULL && status = 'open'`).

### Visual
- Fundo navy escuro (`bg-background` dark), cards com `bg-card/50` + borda sutil + glow laranja nos destaques.
- Tipografia grande (text-3xl/4xl para números), ideal para leitura à distância.
- Animações leves com framer-motion (fade-in on mount, pulse em alertas).
- Badges coloridos reaproveitando `tag_color` dos profiles.

### Detalhes técnicos
- Arquivos novos:
  - `src/pages/Dashboard.tsx` (orquestrador + grid)
  - `src/components/dashboard/ClientsPanel.tsx`
  - `src/components/dashboard/TasksPanel.tsx`
  - `src/components/dashboard/ObligationsPanel.tsx`
  - `src/components/dashboard/TicketsPanel.tsx`
  - `src/components/dashboard/MetricCard.tsx`
- Editar:
  - `src/App.tsx` — registrar rota `/dashboard` dentro do AppLayout.
  - `src/components/AppLayout.tsx` — tratar `/dashboard` como fullscreen (sem header mobile, sem padding).
  - `src/components/AppSidebar.tsx` — novo item de menu "Dashboard" (admin only).
- Queries com `useQuery` + `refetchInterval: 30000`; realtime subscription para chat.
- Sem novas tabelas, sem migrações — tudo lê do esquema existente.
