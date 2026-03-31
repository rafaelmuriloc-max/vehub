
# Corrigir exibição da foto do WhatsApp no chat

## Diagnóstico
A foto já está sendo:
- buscada pela `whatsapp-webhook`
- salva em `chat_conversations.avatar_url`
- carregada no frontend em `src/pages/Chat.tsx`
- passada para `ConversationList` e `MessageArea`

Ou seja: o problema não está no banco nem na query do chat.

## Causa raiz
O bloqueio está no `index.html`, na política de segurança (`Content-Security-Policy`).

Hoje o projeto só permite imagens destes domínios:
- `self`
- `data:`
- `blob:`
- `https://*.supabase.co`
- `https://storage.googleapis.com`

Mas a foto do perfil do WhatsApp está vindo de URL como:
- `https://pps.whatsapp.net/...`

Então o navegador impede o carregamento da imagem, e o componente cai no fallback com a inicial do nome.

## Implementação proposta

### 1. Ajustar a CSP em `index.html`
Atualizar `img-src` para permitir o domínio da foto do WhatsApp:
- adicionar `https://pps.whatsapp.net`

Se necessário, incluir também o host de CDN alternativo usado pelo WhatsApp caso apareça nos logs futuros.

### 2. Melhorar fallback do avatar no chat
Nos componentes:
- `src/components/chat/ConversationList.tsx`
- `src/components/chat/MessageArea.tsx`

Ajustar o uso de `AvatarImage` para continuar exibindo a inicial quando a URL falhar, mas sem mascarar problemas silenciosamente. A estrutura atual já está quase correta; a principal correção é a liberação da origem da imagem.

### 3. Validar fluxo de dados existente
Manter a lógica atual em:
- `src/pages/Chat.tsx`
- `supabase/functions/whatsapp-webhook/index.ts`

Porque ela já está retornando a `avatar_url` corretamente.

## Arquivos a alterar
- `index.html` — liberar `https://pps.whatsapp.net` em `img-src`
- opcionalmente revisar:
  - `src/components/chat/ConversationList.tsx`
  - `src/components/chat/MessageArea.tsx`

## Detalhes técnicos
Evidência encontrada:
- a resposta de `chat_conversations` já contém `avatar_url` preenchido
- exemplo atual: `avatar_url = https://pps.whatsapp.net/...`
- a CSP atual bloqueia esse domínio

Fluxo atual:
```text
Evolution API -> whatsapp-webhook -> chat_conversations.avatar_url
                                      ->
frontend Chat.tsx -> ConversationList / MessageArea -> AvatarImage
                                      X bloqueado pela CSP
```

## Resultado esperado
Depois da correção:
- a lista de conversas mostrará a foto do cliente
- o cabeçalho da conversa mostrará a mesma foto
- o fallback para inicial continuará funcionando quando não houver foto real
