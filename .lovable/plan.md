

# Buscar e-mail do contato por departamento da obrigação

## Resumo
Atualmente o sistema usa o `contact_email` genérico do cliente. A mudança fará com que o destinatário seja buscado na tabela `client_department_contacts`, filtrando pelo `client_id` e pelo `department_id` da obrigação. Se não houver contato específico do departamento, cairá no `contact_email` genérico como fallback.

## Mudanças

### 1. `src/lib/sendActivityEmail.ts` — adicionar parâmetro `departmentId` da obrigação
- Receber `departmentId` (da obrigação, não do e-mail) nos parâmetros
- Buscar primeiro em `client_department_contacts` onde `client_id` e `department_id` correspondem
- Se encontrar `contact_email`, usar esse
- Senão, usar o `contact_email` genérico do `clients` como fallback

### 2. `src/components/ClientObligationsTab.tsx` — passar `departmentId` e pré-preencher destinatário
- No envio automático (`sendActivityEmail`), passar o `department_id` da obrigação
- No envio manual (`EmailComposeDialog`), buscar o e-mail do contato departamental e passá-lo como `recipientEmail`

### 3. `src/pages/CalendarView.tsx` — mesma lógica
- Passar `departmentId` no `sendActivityEmail`
- Pré-preencher `recipientEmail` no `EmailComposeDialog` com o contato departamental

### 4. `src/components/EmailComposeDialog.tsx` — sem mudanças estruturais
- Já aceita `recipientEmail` como prop, apenas será passado corretamente agora

## Detalhes técnicos
- Tabela consultada: `client_department_contacts` (campos `client_id`, `department_id`, `contact_email`)
- Fallback: `clients.contact_email` quando não houver contato específico
- Nenhuma migração necessária

