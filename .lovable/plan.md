

# Buscar foto e nome do WhatsApp para contatos

## Problema
A maioria das conversas (20+) não tem foto de perfil do WhatsApp. Isso acontece porque:
- A função `whatsapp-send` cria conversas **sem buscar a foto** na EvolutionAPI
- A função `whatsapp-webhook` só busca a foto ao criar conversa **nova**, mas não atualiza conversas existentes que não têm foto

## Solução

### Etapa 1 — Atualizar `whatsapp-webhook` para preencher foto faltante
Quando o webhook recebe uma mensagem e encontra uma conversa existente **sem `avatar_url`**, buscar a foto do perfil via EvolutionAPI e atualizar a conversa. Também atualizar o `name` com o `pushName` do WhatsApp se o nome atual for genérico (nome da empresa do banco).

Trecho a adicionar após encontrar a conversa existente (~linha 340):
```typescript
// Se a conversa existe mas não tem avatar, buscar agora
if (conversationId && !existingAvatarUrl) {
  // fetch profile picture via EvolutionAPI
  // update chat_conversations.avatar_url
}
```

### Etapa 2 — Preencher fotos das conversas existentes (one-time)
Criar um script que percorre todas as conversas com `whatsapp_phone` e `avatar_url IS NULL`, chama a EvolutionAPI para buscar a foto de cada uma, e atualiza no banco. Isso será executado via Edge Function temporária ou diretamente.

### Etapa 3 — Atualizar `whatsapp-send` para buscar foto ao criar conversa nova
Quando `whatsapp-send` cria uma conversa nova, buscar a foto de perfil via EvolutionAPI antes de inserir, igual ao webhook faz.

## Arquivos alterados
- `supabase/functions/whatsapp-webhook/index.ts` — buscar avatar para conversas existentes sem foto (~10 linhas)
- `supabase/functions/whatsapp-send/index.ts` — buscar avatar ao criar conversa nova (~15 linhas)
- Execução única de script para atualizar avatares existentes

