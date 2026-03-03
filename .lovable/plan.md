

## Plano: Reestruturar controle de tarefas em Obrigações e Tarefas

### Conceito
Dividir o sistema atual em duas áreas distintas:
1. **Obrigações** — atividades recorrentes vinculadas a departamentos, com sub-atividades tipadas
2. **Tarefas** — solicitações esporádicas (mantém a estrutura atual)

### Novas tabelas (migrações SQL)

**`obligations`** — Obrigações por departamento
- `id` uuid PK, `department_id` uuid FK→departments, `name` text, `description` text, `recurrence` text (mensal/trimestral/anual), `created_at` timestamp, `updated_at` timestamp

**`obligation_activities`** — Atividades de cada obrigação
- `id` uuid PK, `obligation_id` uuid FK→obligations, `title` text, `type` enum (`document`, `checklist`, `whatsapp`, `email`), `description` text, `order` int, `created_at` timestamp

**`obligation_instances`** — Instâncias geradas (competência/período)
- `id` uuid PK, `obligation_id` uuid FK→obligations, `client_id` uuid FK→clients, `reference_month` date, `status` enum (pending/in_progress/done), `assigned_to` uuid, `due_date` date, `created_at` timestamp

**`obligation_activity_completions`** — Conclusão de cada atividade numa instância
- `id` uuid PK, `instance_id` uuid FK→obligation_instances, `activity_id` uuid FK→obligation_activities, `completed` boolean default false, `completed_by` uuid, `completed_at` timestamp, `file_url` text (para tipo document), `notes` text

**Enums**: `activity_type` (document, checklist, whatsapp, email), `obligation_status` (pending, in_progress, done)

**RLS**: Mesma lógica existente — admin gerencia, authenticated visualiza.

### Alterações no frontend

**1. Sidebar (`AppSidebar.tsx`)**
- Renomear "Tarefas" para "Tarefas" (manter)
- Adicionar "Obrigações" com ícone `ClipboardList` apontando para `/obligations`

**2. Nova página `src/pages/Obligations.tsx`**
- Cadastro de obrigações vinculadas a departamento
- Para cada obrigação, CRUD de atividades com tipo (Document/Checklist/WhatsApp/Email)
- Visualização das instâncias por cliente/competência
- Para tipo "Document": upload de arquivo
- Para tipo "Checklist": checkbox de conclusão
- Para tipo "WhatsApp"/"Email": botão de confirmação de envio

**3. Rota em `App.tsx`**
- Adicionar `<Route path="/obligations" element={<Obligations />} />`

**4. Página `Tasks.tsx`**
- Mantém como está — passa a representar apenas as tarefas esporádicas
- Atualizar título para "Tarefas (Solicitações)" para diferenciar

### Fluxo de uso
1. Admin cadastra obrigações por departamento (ex: "Fechamento Fiscal") com atividades (ex: "Enviar DCTF" tipo checklist, "Anexar guia" tipo document)
2. Instâncias são criadas por cliente/competência
3. Usuários marcam atividades como concluídas conforme o tipo
4. Tarefas esporádicas continuam sendo criadas normalmente na página Tarefas

