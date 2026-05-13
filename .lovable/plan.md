## Problema

No diálogo "Anexar arquivo de obrigação", quando a conversa já tem um `clientId` definido, apenas essa única empresa aparece. Contatos (telefone do WhatsApp) costumam estar vinculados a várias empresas via `client_department_contacts`, e nenhuma das outras é listada.

Hoje o `useEffect` de carregamento de empresas faz:
```ts
if (conversationClientId) clientIds = [conversationClientId];
else if (whatsappPhone) ... busca por telefone
```
O `else` impede a busca por telefone quando já existe um clientId.

## Solução

Editar `src/components/chat/AttachFromObligationDialog.tsx`:

1. Sempre que `whatsappPhone` existir, consultar `client_department_contacts` filtrando pelos últimos 8 dígitos do telefone e coletar todos `client_id` vinculados.
2. Unir esse conjunto com `conversationClientId` (se houver), de modo que a empresa "principal" da conversa nunca suma e as demais empresas do contato também apareçam.
3. Manter dedupe via `Set<string>` e `order('company_name')` na consulta a `clients`.
4. Manter o auto-select quando houver apenas uma empresa; quando houver várias, não pré-selecionar nenhuma (o usuário escolhe).

Nenhuma outra mudança de UI/regra de negócio. Sem mudanças em `Chat.tsx`.