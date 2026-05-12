## Etiqueta do responsável nos chamados abertos

Adicionar uma etiqueta (badge) em cada item da lista de conversas abertas indicando qual usuário está atribuído àquele chamado.

### Comportamento

- Exibir badge apenas quando `status = 'open'` e existir `assigned_to`.
- Texto: primeiro nome do responsável (ex.: "Bruno"). Conversas sem responsável exibem badge "Não atribuído" em tom neutro.
- Conversas fechadas (`closed`) não exibem etiqueta.
- Visível nas três abas (Chat, Em andamento, Geral).

### Arquivos afetados

**`src/pages/Chat.tsx`** (`loadConversations`)
- Coletar `assigned_to` de cada conversa, buscar `full_name` em `profiles` (numa única query por `in`).
- Adicionar campos `assignedToId` e `assignedToName` em cada item retornado.

**`src/components/chat/ConversationList.tsx`**
- Estender a interface `ConversationItem` com `assignedToName?: string | null` e `status?: string`.
- No item da lista, abaixo da última mensagem (ou ao lado do nome), renderizar um `Badge` pequeno:
  - `status === 'open'` + nome → badge `secondary` com ícone `User` e o primeiro nome.
  - `status === 'open'` + sem nome → badge `outline` "Não atribuído".
- Usar tokens semânticos do design system (não cores fixas).

### Fora de escopo

- Alterar atribuição/transferência (já existe diálogo de transferência).
- Avatar do responsável (apenas texto+ícone para manter compacto).
