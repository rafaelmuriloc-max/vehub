## Objetivo

Permitir múltiplos contatos por departamento na aba **Contato** do cadastro de empresa. Mesmos campos atuais (nome, telefone, e-mail). Disparos de WhatsApp/E-mail por departamento passam a enviar para **todos** os contatos do depto.

## Schema

Migration:
- `ALTER TABLE public.client_department_contacts DROP CONSTRAINT client_department_contacts_client_id_department_id_key;`
- `CREATE INDEX IF NOT EXISTS idx_cdc_client_dept ON public.client_department_contacts(client_id, department_id);`

## Front-end (`src/pages/Clients.tsx`)

- Estado: `Record<deptId, DeptContact[]>` (array por depto).
- Carregamento agrupa as linhas por `department_id`. Se um depto não tem nenhum contato, inicializa com `[ { vazio } ]` para a UI mostrar uma linha em branco.
- UI da aba Contato: para cada departamento, listar todos os contatos com nome / telefone / e-mail, botão "Remover" por linha e botão "+ Adicionar contato" abaixo do bloco do depto.
- Salvamento: `delete` de todos os `client_department_contacts` daquele `client_id` e `insert` em lote (filtrando entradas totalmente vazias).

## Disparos (envio para todos os contatos do depto)

- `src/lib/sendActivityWhatsApp.ts` e `src/lib/sendActivityEmail.ts`: trocar `maybeSingle()` por `select(...)` retornando lista; iterar enviando para cada contato com telefone/e-mail válido. Fallback: contato principal do cliente se a lista vier vazia.
- `src/components/ClientObligationsTab.tsx` e `src/pages/CalendarView.tsx`: ajustar `maybeSingle()` para listar todos os e-mails do depto e juntar (vírgula) no campo de destinatários, mantendo a UI atual de envio único.

Sem alteração nos demais consumidores (`Chat.tsx`, `NewConversationDialog.tsx`, `AttachFromObligationDialog.tsx`) — já tratam listas.
