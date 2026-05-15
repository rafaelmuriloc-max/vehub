## Mudança

Filtrar a lista "Cliente *" do `TaskRequestForm` para mostrar apenas as empresas vinculadas ao contato da conversa (mesmo critério usado em `companyNames`: telefone do contato batendo via `client_department_contacts.contact_phone` pelos últimos 8 dígitos).

## Implementação

1. **`src/components/chat/TaskRequestForm.tsx`**
   - Nova prop opcional `restrictToPhone?: string | null`.
   - Quando `restrictToPhone` estiver presente, após carregar a lista geral de clientes, consultar `client_department_contacts` filtrando por `contact_phone ilike '%<últimos 8 dígitos>%'`, coletar `client_id` distintos e filtrar `clients` para exibir apenas esses.
   - Se não houver vínculos, manter mensagem padrão e nenhuma opção; mostrar texto "Nenhum cliente vinculado a este contato".
   - Se `restrictToPhone` for nulo/ausente, comportamento atual (todos os clientes).
   - Pré-seleciona automaticamente o cliente quando houver apenas um vínculo.

2. **`src/pages/Chat.tsx`**
   - Passar `restrictToPhone={activeConv?.whatsappPhone || null}` para `<TaskRequestForm />`.

Sem mudanças de schema. Sem mudanças no `defaultClientId` (continua respeitado).