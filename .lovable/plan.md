

## Plano: Cadastro do Escritório (Empresa, Departamentos, Sócios, Usuários)

### 1. Novas Tabelas no Supabase (Migration)

- **`company_settings`** — dados do escritório (razão social, CNPJ, endereço, telefone, email, logo_url, etc.). Tabela singleton (uma linha).
- **`departments`** — id, name, description, created_at. Vinculado ao escritório.
- **`partners`** — id, name, document (CPF), email, phone, role/title, ownership_percentage, active, created_at.
- RLS: somente admins podem gerenciar; todos autenticados podem visualizar.

### 2. Nova Página: `/settings`

Página com **Tabs** (usando o componente Tabs existente):

- **Empresa** — formulário para editar dados do escritório (razão social, CNPJ, endereço, telefone, email)
- **Departamentos** — CRUD simples com tabela + dialog para adicionar/editar
- **Sócios** — CRUD com tabela + dialog (nome, CPF, email, telefone, % participação)
- **Usuários** — lista de profiles + user_roles existentes, com possibilidade de alterar role (admin/employee) e editar cargo

### 3. Sidebar

Adicionar item "Cadastro" com ícone `Building2` no menu, apontando para `/settings`. Agrupar como seção "Administração" separada.

### 4. Permissões

- Apenas admins podem editar dados da empresa, departamentos, sócios e gerenciar usuários
- Funcionários podem visualizar mas não editar

### Detalhes Técnicos

- Profiles já linkados a `user_id` serão listados na aba Usuários via join com `user_roles`
- `company_settings` usa upsert (insert or update) já que é singleton
- Departments podem ser vinculados opcionalmente aos profiles (coluna `department_id` adicionada a profiles)

