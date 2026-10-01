# Opção "Tarefa interna" no Cadastro de tarefas

## O que muda
- O formulário da aba **Cadastro** ganha a chave **"Tarefa interna"**. Ela vem desligada.
- Quando a chave está ligada, o aviso ao cliente por WhatsApp fica desligado e escondido no cadastro.
- Ao solicitar uma tarefa a partir de um modelo interno, a caixa "Tarefa interna" já vem marcada e o cliente fica opcional. Você ainda pode desmarcar a caixa se quiser.
- Na lista de tarefas cadastradas, os modelos internos aparecem com o selo "Interna".

## Detalhes técnicos
- Migração: `ALTER TABLE public.task_templates ADD COLUMN is_internal boolean NOT NULL DEFAULT false;`.
- `src/pages/Tasks.tsx`:
  - `is_internal` no tipo `TaskTemplate`, em `templateForm` (novo e edição) e no payload de salvar. Quando for interna, salva com `notify_whatsapp=false`.
  - Switch no formulário do cadastro.
  - Selo na lista de modelos.
- `src/components/chat/TaskRequestForm.tsx`: ao escolher um modelo, `setIsInternal(!!template.is_internal)`.
