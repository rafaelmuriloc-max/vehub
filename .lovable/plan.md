

## Plano: Contatos por departamento no cadastro de clientes

### Objetivo
Cada cliente terá um contato (nome, telefone, e-mail) por departamento, para receber notificações específicas daquele departamento.

### Implementação

#### 1. Nova tabela `client_department_contacts`
Migration para criar:

```sql
CREATE TABLE public.client_department_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  contact_name text,
  contact_phone text,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, department_id)
);
```

RLS: autenticados podem visualizar, admins podem inserir/atualizar/deletar (mesmo padrão das outras tabelas).

#### 2. Alterar `src/pages/Clients.tsx`

- Buscar a lista de departamentos ao abrir o dialog
- Adicionar uma nova aba **"Contatos"** (ou seção dentro do formulário) com os campos de contato para cada departamento
- Para cada departamento existente (Fiscal, Pessoal, Societário, Financeiro, Sucesso do Cliente), exibir:
  - **Nome** (input text)
  - **Telefone** (input text)
  - **E-mail** (input email)
- Ao salvar o cliente, fazer upsert dos contatos na tabela `client_department_contacts`
- Ao editar, carregar os contatos existentes

#### 3. Detalhes Técnicos
- Constraint `UNIQUE(client_id, department_id)` garante um contato por departamento por cliente
- Upsert via `ON CONFLICT (client_id, department_id) DO UPDATE`
- Os departamentos são carregados dinamicamente da tabela `departments`, então se novos departamentos forem adicionados, aparecerão automaticamente

