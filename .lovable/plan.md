

# Exibir foto de perfil do WhatsApp do cliente no Chat

## Problema
Atualmente, o avatar na lista de conversas e no cabeçalho mostra apenas a inicial do nome. O usuário quer exibir a foto de perfil real do WhatsApp do cliente.

## Abordagem
A EvolutionAPI oferece um endpoint para buscar a foto de perfil de um contato:
```
POST {EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/{instance}
Body: { "number": "554791004860" }
```
Precisamos armazenar a URL da foto na conversa e exibi-la no UI.

## Pré-requisitos — Secrets necessários
Não existem secrets da EvolutionAPI configurados. Precisamos de:
- **EVOLUTION_API_URL** — URL base da instância EvolutionAPI (ex: `https://api.evolution.example.com`)
- **EVOLUTION_API_KEY** — Chave de API da EvolutionAPI
- **EVOLUTION_INSTANCE_NAME** — Nome da instância (ex: `minha-instancia`)

## Alterações

### 1. Migração SQL
Adicionar coluna `avatar_url text` na tabela `chat_conversations`.

### 2. `supabase/functions/whatsapp-webhook/index.ts`
Quando uma conversa é **criada** (nova), chamar a EvolutionAPI para buscar a foto de perfil e salvar na coluna `avatar_url`:
```typescript
const profileRes = await fetch(`${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${INSTANCE}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
  body: JSON.stringify({ number: phoneRaw })
});
const profileData = await profileRes.json();
// profileData.profilePictureUrl → salvar em chat_conversations.avatar_url
```

### 3. `src/pages/Chat.tsx`
Ao carregar conversas, incluir o campo `avatar_url` na query e passá-lo para os componentes.

### 4. `src/components/chat/ConversationList.tsx`
Usar `AvatarImage` com a URL do avatar quando disponível, fallback para a inicial.

### 5. `src/components/chat/MessageArea.tsx`
No header, exibir a foto do avatar quando disponível.

## Arquivos modificados
- Migração SQL — coluna `avatar_url`
- `supabase/functions/whatsapp-webhook/index.ts` — buscar foto de perfil
- `src/pages/Chat.tsx` — incluir `avatar_url` no carregamento
- `src/components/chat/ConversationList.tsx` — exibir foto
- `src/components/chat/MessageArea.tsx` — exibir foto no header

