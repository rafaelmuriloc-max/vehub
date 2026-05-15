## Mover configuração de notificação para o cadastro da tarefa

A configuração de envio por WhatsApp/E-mail deve ficar no **cadastro de tarefa** (template) e não na solicitação/edição da instância. Cada tarefa criada herda os valores do template.

### Banco

Adicionar em `task_templates`:
- `notify_whatsapp boolean not null default false`
- `notify_email boolean not null default false`
- `notify_message text`
- `notify_email_subject text`

Manter as colunas equivalentes em `tasks` (já criadas) — elas guardam o snapshot usado pela edge function `task-notify-client` no momento da conclusão.

### `src/pages/Tasks.tsx`

- **Diálogo de template** ("Nova Tarefa Cadastrada"): adicionar a seção "Notificar cliente ao concluir" com os dois switches, textarea de mensagem e (se e-mail ativo) campo de assunto. Persistir no insert/update de `task_templates`.
- **`handleRequest` (Solicitar)**: ao criar a `task`, copiar `notify_whatsapp`, `notify_email`, `notify_message`, `notify_email_subject` do template selecionado.
- **Diálogo de edição da tarefa**: remover a seção de notificação adicionada no passo anterior. A tarefa continua disparando a notificação ao mudar status para `done` (via `triggerNotify`), usando os valores já armazenados na própria `tasks`.
- O `templateForm` ganha os 4 campos e o `openNewTemplate` / `openEditTemplate` os hidratam.

### Edge function

Sem mudanças — `task-notify-client` continua lendo de `tasks`.
