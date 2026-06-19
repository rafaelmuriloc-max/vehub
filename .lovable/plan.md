## Mudança

Enviar a mensagem de "Sem Movimento" do PGDAS-D para o **contato do Depto Fiscal** cadastrado na empresa, em vez do telefone principal do cliente.

### `supabase/functions/pgdasd-sem-movimento/index.ts`

1. Antes de usar `client.contact_phone`, consultar `client_department_contacts` filtrando por `client_id = inst.client_id` e `department_id = '7403523f-3518-4f8e-b6c3-5f252ced0f34'` (Depto Fiscal).
2. Ordem de prioridade do telefone:
   1. `client_department_contacts.contact_phone` do Depto Fiscal (se preenchido).
   2. Fallback: `clients.contact_phone`.
   3. Se nenhum: retornar `whatsapp_error: "Cliente sem telefone do Depto Fiscal cadastrado"`.
3. Adicionar `console.log` mostrando origem do telefone (`fiscal_contact` vs `client_main`) e número normalizado, para facilitar debug futuro.

Sem mudanças em UI, schema ou outras funções — o toast do `CalendarView` já exibe `whatsapp_error`.
