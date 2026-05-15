Quando a tarefa é marcada como concluída e dispara a notificação para o cliente, a mensagem (WhatsApp e e-mail) deve ser assinada com o nome do usuário que concluiu a tarefa, exibido em **negrito acima** do corpo da mensagem.

## Mudanças

**`supabase/functions/task-notify-client/index.ts`**

1. Usar o usuário autenticado da requisição (`user.id`) como "quem concluiu", buscando `profiles.full_name` desse `user_id` (em vez de só usar `task.created_by` para a variável `responsavel`).
2. Montar um cabeçalho com o nome do usuário e prefixar a mensagem final:
   - **WhatsApp** (texto enviado via Meta Cloud API): `*Nome do Usuário*\n\n` + mensagem renderizada. O `*...*` é a sintaxe oficial de negrito do WhatsApp.
   - **E-mail** (HTML): `<p><strong>Nome do Usuário</strong></p>` antes do `<p>` com o corpo.
3. Manter `responsavel` no `templateVars` apontando para o nome do usuário que concluiu (para `{{responsavel}}` em templates já refletir quem fechou).
4. Não alterar template salvo do usuário; o nome é adicionado em runtime apenas.

## Frontend

Nenhuma mudança — `TaskEditDialog` já chama `task-notify-client` quando a tarefa muda para `done`, e o JWT do usuário logado vai junto.

## Observações

- Sem mudanças em schema, RLS ou outras funções.
- Sem mudanças em fluxo de anexos.
