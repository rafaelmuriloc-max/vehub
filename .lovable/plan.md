## Objetivo
Adicionar um seletor de cor no cadastro de usuário. Essa cor será usada como fundo da tag de atribuição (`assignedToName`) na lista de conversas do chat.

## Mudanças

### 1. Banco de dados (migração)
- `profiles`: adicionar coluna `tag_color text` (hex, ex: `#D97706`), nullable, default `NULL`.
- Atualizar a função RPC `get_user_chat_conversations` (última versão em `20260513211605_*`) para também retornar `assigned_to_color text` (vindo de `profiles.tag_color`).

### 2. Backend de usuário (Edge Function `manage-user`)
- Aceitar campo opcional `tag_color` em `create` e `update`, gravando em `profiles.tag_color`.

### 3. UI – Cadastro/edição de usuário (`src/components/settings/UsersTab.tsx`)
- Adicionar campo "Cor da tag" nos formulários de criar e editar:
  - Input nativo `<input type="color">` + presets de cores rápidas (8 cores) + opção limpar.
- Persistir e enviar `tag_color` para `manage-user`.
- Exibir um pequeno chip com a cor na coluna "Permissão" (ou nova coluna "Cor") da tabela de usuários.

### 4. Chat – Tag de atribuição (`src/components/chat/ConversationList.tsx` + `src/pages/Chat.tsx`)
- Mapear `assigned_to_color` no `ConversationItem` (campo `assignedToColor?: string`).
- Em `ConversationList`, aplicar a cor via `style={{ backgroundColor: color, color: '#fff' }}` no `Badge` quando `assignedToColor` existir; manter o `bg-amber-600` atual como fallback.

## Detalhes técnicos
- A cor é armazenada como hex string. Sem CHECK constraint (validação client-side via input type=color).
- Cor de texto: usar branco (`#fff`) — todas as cores presets serão escuras o suficiente. Para cor custom, calcular contraste simples com luminância YIQ se quiser maior robustez.
- Tipos do Supabase (`types.ts`) serão regenerados automaticamente após a migração.

## Arquivos afetados
- `supabase/migrations/<novo>.sql` — coluna + RPC atualizada
- `supabase/functions/manage-user/index.ts`
- `src/components/settings/UsersTab.tsx`
- `src/components/chat/ConversationList.tsx`
- `src/pages/Chat.tsx`
