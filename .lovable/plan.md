## Objetivo

Substituir a lista de "Nova Conversa" — que hoje só lista usuários internos (`profiles`) — por uma lista de **contatos externos**, e fazer com que toda nova conversa criada seja uma conversa de **WhatsApp**.

## Fontes de contatos a unificar

1. **Cadastrados nas empresas**
   - `clients.contact_name` + `clients.contact_phone`
   - `client_department_contacts.contact_name` + `contact_phone`
2. **Remetentes WhatsApp já conhecidos sem vínculo a empresa**
   - `chat_conversations` com `whatsapp_phone` preenchido e `client_id IS NULL`, usando `name` (pushName) como nome do contato.

Deduplicação por telefone normalizado (apenas dígitos). Prioridade quando o mesmo telefone aparecer em mais de uma fonte: cliente > contato departamental > remetente avulso.

## Mudanças no front-end

Arquivo: `src/components/chat/NewConversationDialog.tsx`

- Trocar a query de `profiles` por buscas paralelas em `clients`, `client_department_contacts` e `chat_conversations` (filtro `whatsapp_phone IS NOT NULL`).
- Construir `Contact { phone, name, companyName? }` unificado. **Não exibir departamento** — manter visual atual (avatar + nome + linha secundária com nome da empresa, quando houver, ou "Contato WhatsApp").
- Busca por nome ou telefone.
- Ao clicar em um contato:
  1. Procurar `chat_conversations` existente com aquele `whatsapp_phone` (normalizado). Se encontrar, abrir.
  2. Caso contrário, criar `chat_conversations` com `whatsapp_phone`, `name` (do contato), `client_id` (quando vier de cliente), `created_by` = usuário atual, `is_group=false`, `assigned_to` = usuário atual; e adicionar o usuário atual em `chat_participants`.
- Remover a lógica antiga de detecção de 1:1 entre usuários internos.
