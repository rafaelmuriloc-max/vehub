

# CRUD completo de Usuários

## Situação atual
A aba Usuários tem apenas **listagem** e **edição** (cargo, departamento, permissão). Faltam **criar** (convidar) e **excluir** usuários.

## O que será feito

### 1. Edge function `manage-user` (nova)
Uma edge function com `SUPABASE_SERVICE_ROLE_KEY` para operações admin:
- **POST** `action: "invite"` — usa `supabase.auth.admin.inviteUserByEmail()` para enviar convite por email
- **POST** `action: "delete"` — usa `supabase.auth.admin.deleteUser()` + deleta profile e role associados

Necessário porque o client-side SDK não tem acesso admin ao auth.

### 2. UI — Botão "Convidar Usuário" (`UsersTab.tsx`)
- Botão no header do Card (visível apenas para admin)
- Dialog com campos: **Email**, **Nome**, **Cargo**, **Departamento**, **Permissão**
- Ao confirmar, chama a edge function `manage-user` com `action: "invite"`
- O usuário receberá email de convite para definir sua senha

### 3. UI — Botão "Excluir" na tabela (`UsersTab.tsx`)
- Ícone de lixeira ao lado do lápis (apenas admin)
- Confirmação via AlertDialog antes de excluir
- Chama a edge function `manage-user` com `action: "delete"` + `userId`
- Impede que o admin exclua a si mesmo

### 4. UI — Edição do nome (`UsersTab.tsx`)
- Adicionar campo **Nome** ao dialog de edição (atualiza `profiles.full_name`)

## Arquivos
- `supabase/functions/manage-user/index.ts` (novo, ~60 linhas)
- `src/components/settings/UsersTab.tsx` (reescrita com Create/Delete, ~200 linhas)

## Fluxo
```text
Admin clica "Convidar" → preenche email/nome/cargo → edge function cria user no auth + profile + role → usuário recebe email

Admin clica "Excluir" → confirma → edge function remove do auth (cascata remove profile/role)
```

