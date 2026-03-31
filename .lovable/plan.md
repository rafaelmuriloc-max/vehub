

# Mostrar empresas vinculadas no cabeçalho da conversa (via contatos departamentais)

## Problema
O usuário quer ver as empresas vinculadas ao contato no cabeçalho da conversa. A vinculação deve ser feita pelo telefone cadastrado na aba "Contatos" (tabela `client_department_contacts.contact_phone`), não pelo `clients.contact_phone`.

## Lógica
Para cada conversa com `whatsapp_phone`, buscar todos os registros em `client_department_contacts` cujo `contact_phone` contenha esse número. Com os `client_id`s encontrados, buscar os nomes das empresas em `clients.company_name`. Passar como `companyNames: string[]` para o header.

## Alterações

### 1. `src/components/chat/ConversationList.tsx`
- Adicionar `companyNames?: string[]` ao tipo `ConversationItem`

### 2. `src/pages/Chat.tsx`
- Na `loadConversations`, para conversas com `whatsapp_phone`:
  - Buscar `client_department_contacts` onde `contact_phone` contém o número (ilike)
  - Coletar `client_id`s únicos
  - Buscar `clients.company_name` para esses IDs
  - Salvar no item como `companyNames`
- Passar `companyNames` para `MessageArea`

### 3. `src/components/chat/MessageArea.tsx`
- Adicionar prop `companyNames?: string[]`
- No header, abaixo do nome do contato, exibir as empresas separadas por ` | ` em texto menor e cinza
- Mostrar apenas quando `companyNames.length > 0`

## Arquivos modificados
- `src/components/chat/ConversationList.tsx` — tipo atualizado
- `src/pages/Chat.tsx` — query de contatos departamentais + passagem de prop
- `src/components/chat/MessageArea.tsx` — exibição das empresas no header

