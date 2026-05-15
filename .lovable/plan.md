## Objetivo

Garantir que a tag do atendente atribuído (mostrada no card da conversa em `/chat`) apareça pintada com a cor cadastrada para o usuário em Configurações → Usuários (`profiles.tag_color`), e não sempre na cor laranja padrão.

## Diagnóstico

A infraestrutura já existe:
- `profiles.tag_color` é editado em `src/components/settings/UsersTab.tsx`.
- A RPC `get_chat_inbox` já retorna `assigned_to_color = p.tag_color`.
- `src/pages/Chat.tsx` já mapeia para `assignedToColor`.
- `src/components/chat/ConversationList.tsx` já aplica `style={{ backgroundColor: conv.assignedToColor || '#D97706' }}` no Badge.

O problema visível: quando o perfil do atendente está sem `tag_color`, o fallback `#D97706` (laranja) é usado para todo mundo, dando a impressão de que a cor "do usuário" não é respeitada. Além disso, o texto é fixo em `text-slate-50`, o que pode ficar ilegível em cores claras escolhidas pelo usuário.

## Mudanças

### 1) `src/components/chat/ConversationList.tsx`
- Remover o fallback fixo `#D97706` do Badge do atendente. Quando `assignedToColor` estiver vazio, usar uma cor neutra do design system (`hsl(var(--muted))`) com texto `hsl(var(--muted-foreground))`, deixando claro visualmente que o usuário ainda não tem cor definida.
- Calcular dinamicamente a cor do texto a partir do `assignedToColor` (luminância YIQ) para garantir contraste — texto branco em fundos escuros e texto quase-preto em fundos claros. Aplicar via `style.color` no Badge, em vez da classe fixa `text-slate-50`.
- Pequena utilitária local `getReadableTextColor(hex)` no mesmo arquivo (sem nova dependência).

### 2) Sem alterações de schema, RPC, RLS ou Edge Functions
A coluna e o pipeline de dados já existem. Nenhuma migração nova é necessária.

## Observação para o usuário

Para que cada atendente apareça com cor distinta no card, é preciso definir a cor em **Configurações → Usuários → Editar usuário → Cor da tag**. Usuários sem cor cadastrada ficarão com a tag cinza neutra após esta mudança.

## Resumo do escopo

Apenas ajustes de UI em `ConversationList.tsx`. Nenhuma mudança de lógica de negócio.
