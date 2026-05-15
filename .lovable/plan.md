## Objetivo

Ao abrir uma conversa, mostrar automaticamente um painel à direita (dentro da `MessageArea`, abaixo do cabeçalho) com cards das tarefas em status "A Fazer" (`todo`) das empresas vinculadas ao contato (telefone) da conversa.

## Comportamento

- Painel aparece **somente se houver pelo menos uma tarefa `todo`** para os clientes vinculados ao telefone do contato.
- Painel é exclusivo da conversa atual: ao trocar de conversa, recarrega.
- Cada card mostra: empresa (cliente), título, prioridade, prazo (`due_date`), responsáveis. Clicar no card abre `/tasks?id=...` em nova aba.
- Botão de fechar (X) no cabeçalho do painel; estado `tasksPanelOpen` permite reabrir via novo botão "Tarefas pendentes" no header da conversa (ícone `ListTodo`) — mesmo padrão visual do botão de solicitar tarefa.
- Quando o usuário abre o painel "Solicitar Tarefa" (`taskPanelOpen`), ele substitui o painel de tarefas pendentes (mesmo slot `rightPanel`). Ao fechar, o painel de tarefas pendentes reaparece se ainda houver itens.

## Implementação

### Novo componente `src/components/chat/PendingTasksPanel.tsx`
- Props: `phone: string | null`, `onClose: () => void`, `onCountChange?: (n:number)=>void`.
- Resolve `linkedClientIds`: consulta `client_department_contacts` filtrando por últimos 8 dígitos do telefone (mesma lógica usada em `TaskRequestForm`), coleta `client_id` distintos.
- Carrega tarefas:
  ```
  supabase.from('tasks')
    .select('id,title,priority,due_date,client_id,clients(company_name),task_assignments(user_id,profiles:profiles!inner(full_name))')
    .in('client_id', linkedClientIds)
    .eq('status', 'todo')
    .order('due_date', { ascending: true, nullsFirst: false });
  ```
- Renderiza `ScrollArea` com lista de `Card` (design tokens: `bg-card`, `border`, `text-card-foreground`); badge de prioridade com cores semânticas; ícone de relógio + `due_date` formatado em pt-BR; avatar/nome do(s) responsável(is).
- Cabeçalho do painel: título "Tarefas pendentes" + contador + botão X (mesmo padrão do `TaskPanel` atual).
- Empty/loading states adequados.
- Realtime opcional: subscribe em `tasks` filtrando pelos client_ids para refletir mudanças (manter simples — apenas refetch ao mudar `phone`).

### `src/pages/Chat.tsx`
- Novo estado: `pendingTasksCount` (number) e `pendingTasksOpen` (boolean, default `true`).
- `useEffect([activeConvId])`: resetar `pendingTasksOpen = true` (e o existente `setTaskPanelOpen(false)`).
- Calcular `rightPanel`:
  - Se `taskPanelOpen` → mantém atual `TaskPanel` (Solicitar Tarefa).
  - Senão se `pendingTasksOpen && activeConv?.whatsappPhone` → renderiza `<PendingTasksPanel phone=... onClose={()=>setPendingTasksOpen(false)} onCountChange={setPendingTasksCount} />`.
  - Senão `null`.
- Adicionar botão "Tarefas pendentes" no header (junto ao botão Solicitar Tarefa) quando `pendingTasksCount > 0` e painel fechado, exibindo badge com a contagem. Reabre ao clicar.

### Sem mudanças de schema
- Usa tabelas existentes (`tasks`, `task_assignments`, `clients`, `client_department_contacts`, `profiles`). RLS já permite leitura de tasks para admins/criador/atribuído; para Funcionários não-atribuídos as tarefas simplesmente não aparecerão (comportamento esperado).

## Notas de UI
- Largura do painel mantém `md:w-[420px]` já usado em `MessageArea.rightPanel`.
- Cards usam apenas tokens semânticos (`bg-card`, `text-muted-foreground`, `border`, `ring-primary/10`).
- Mobile: reutiliza o mesmo slot — em telas estreitas o painel ocupa `w-full` (já configurado em `MessageArea`).