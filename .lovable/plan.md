

# Seção "Enviados" na página de E-mail

## Resumo
Criar uma tabela `email_logs` para registrar cada e-mail enviado, e exibir uma seção "Enviados" abaixo do formulário de composição com as colunas solicitadas.

## 1. Migração SQL — nova tabela `email_logs`

```sql
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_html text,
  client_id uuid,
  obligation_id uuid,
  reference_month date,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email_logs" ON public.email_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert email_logs" ON public.email_logs
  FOR INSERT TO authenticated WITH CHECK (true);
```

## 2. Registrar envio — `src/pages/Email.tsx`
- Após envio bem-sucedido via `smtp-send`, inserir registro na `email_logs` com `department_id`, `recipient_email`, `subject`, `body_html`, `status='sent'`
- Os campos `client_id`, `obligation_id`, `reference_month` ficam null para envios manuais (preenchidos automaticamente nos envios via obrigações)

## 3. Registrar envio automático — `src/lib/sendActivityEmail.ts`
- Após envio bem-sucedido, inserir na `email_logs` com `client_id`, `obligation_id` (da instância), `reference_month`, `subject`, `recipient_email`

## 4. Seção "Enviados" — `src/pages/Email.tsx`
- Adicionar Tabs: "Compor" e "Enviados"
- Na aba "Enviados": tabela com colunas Data, Hora, Cliente, Obrigação, Competência, Status
- Buscar `email_logs` com joins em `clients` e `obligations` para exibir nomes
- Como não há FK formal, buscar clientes e obrigações separadamente e mapear por id
- Badge colorido para status (verde=sent, vermelho=failed)
- Paginação e ordenação por `sent_at DESC`

## Arquivos modificados
- **Migração SQL** — nova tabela `email_logs`
- `src/pages/Email.tsx` — tabs + tabela de enviados + insert após envio
- `src/lib/sendActivityEmail.ts` — insert na `email_logs` após envio automático

