## Cadastro direto de usuários (e-mail + senha)

Substituir o fluxo atual de "Convidar Usuário" (que envia e-mail de convite) por um cadastro direto, onde o admin define o e-mail (pode ser fictício) e a senha do novo usuário no momento da criação.

### Mudanças

**1. Edge function `supabase/functions/manage-user/index.ts`**
- Trocar action `invite` por `create`.
- Em vez de `auth.admin.inviteUserByEmail`, usar `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })` — isso cria o usuário já confirmado, sem envio de e-mail.
- Manter a atualização de `profiles` (job_title, department_id) e `user_roles` (admin/employee) após a criação.
- Validação: e-mail e senha obrigatórios; senha com mínimo de 6 caracteres.

**2. `src/components/settings/UsersTab.tsx`**
- Renomear botão "Convidar Usuário" → "Novo Usuário" (ícone `UserPlus` permanece).
- Renomear estado `inviteOpen`/`inviteForm`/`handleInvite` → `createOpen`/`createForm`/`handleCreate`.
- Adicionar campo **Senha** (input type="password") no diálogo, abaixo do e-mail. Adicionar microcopy: "O e-mail pode ser fictício e será usado apenas para login."
- Título do diálogo: "Novo Usuário". Botão: "Criar Usuário".
- Chamar a edge function com `action: 'create'` enviando `email`, `password`, `full_name`, `job_title`, `department_id`, `role`.
- Toast de sucesso: "Usuário criado".

### Observações técnicas
- Como o Supabase exige formato de e-mail válido, e-mails "fictícios" precisam ter sintaxe válida (ex.: `joao@empresa.local`). Vou deixar isso explícito na microcopy.
- `email_confirm: true` evita que o Supabase tente enviar e-mail de confirmação para endereços fictícios.
- Nenhuma migração de banco é necessária — o trigger `handle_new_user` já cria `profile` e `user_roles` automaticamente.
