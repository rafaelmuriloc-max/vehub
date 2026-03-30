

# Envio de e-mail via SMTP por departamento

## Objetivo
Cada departamento terá suas próprias credenciais SMTP do Gmail configuradas. Ao enviar um e-mail, o sistema usará as credenciais do departamento remetente.

## Mudanças

### 1. Migração SQL — adicionar colunas SMTP na tabela `departments`
```sql
ALTER TABLE departments
  ADD COLUMN smtp_email text,
  ADD COLUMN smtp_password text;
```
- `smtp_email`: endereço Gmail do departamento (ex: fiscal@escritorio.com)
- `smtp_password`: senha de app do Gmail (não a senha da conta)

### 2. Atualizar formulário de departamento (`DepartmentsTab.tsx`)
- Adicionar campos "E-mail SMTP" e "Senha de App" no dialog de criação/edição
- Campo de senha com tipo `password` e botão para mostrar/ocultar
- Texto auxiliar: "Use uma Senha de App do Google, não a senha da conta"

### 3. Nova Edge Function `smtp-send/index.ts`
- Recebe: `departmentId`, `to`, `subject`, `body` (HTML)
- Busca credenciais SMTP do departamento no banco (via service role)
- Envia e-mail via Gmail SMTP (`smtp.gmail.com:465`) usando a lib `nodemailer` (disponível no Deno via npm)
- Validação de input com Zod
- CORS headers para chamada do frontend

### 4. Nova página de composição de e-mail (`src/pages/Email.tsx`)
- Formulário: Departamento (select), Destinatário, Assunto, Corpo (textarea)
- Select de departamento mostra apenas departamentos com SMTP configurado
- Botão "Enviar" chama `supabase.functions.invoke('smtp-send', { body: {...} })`
- Toast de sucesso/erro

### 5. Rota e navegação
- Nova rota `/email` em `App.tsx`
- Novo item "E-mail" com ícone `Mail` no sidebar (`AppSidebar.tsx`)

## Pré-requisito do usuário
Para cada departamento, gerar uma **Senha de App** no Google:
1. Acessar myaccount.google.com → Segurança → Senhas de app
2. Criar uma senha de app para "Outro (nome personalizado)"
3. Colar a senha de 16 caracteres no campo "Senha de App" do departamento

## Detalhes técnicos
- Arquivos modificados: `DepartmentsTab.tsx`, `AppSidebar.tsx`, `App.tsx`
- Arquivos criados: `supabase/functions/smtp-send/index.ts`, `src/pages/Email.tsx`
- Nova migração para colunas SMTP
- A senha SMTP fica no banco (acessível apenas via service role na Edge Function)

