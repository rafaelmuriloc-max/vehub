## Diagnóstico

Investiguei o banco e o webhook do WhatsApp:

- 24 conversas têm `avatar_url` NULL (ex: Drika, Marcelo Cananea, Angela Portella). O webhook só busca a foto quando uma conversa é criada ou quando recebe mensagem nova com avatar vazio — conversas antigas anteriores a esse código nunca foram atualizadas.
- As URLs do WhatsApp (`pps.whatsapp.net/...?oe=...`) **expiram** após alguns dias. Conversas com URL salva mas vencida (ex: Rafael Murilo, com `oe=` apontando para abril/2026) deixam de exibir a foto.

Ou seja: o `<AvatarFallback>` aparece tanto por URL ausente quanto por URL expirada (404).

## Plano

### 1. Edge Function `whatsapp-refresh-avatars` (nova)

- Lista todas as `chat_conversations` com `whatsapp_phone IS NOT NULL`.
- Para cada uma, chama `POST /chat/fetchProfilePictureUrl/{instance}` na Evolution API com o número.
- Atualiza `avatar_url` quando retornar uma URL válida; mantém o valor existente se a Evolution não retornar nada.
- Aceita parâmetro opcional `onlyMissing=true` para rodar apenas nas conversas sem foto.
- Retorna contagem de atualizadas / falhas.

### 2. CRON diário

- Agendar a função para rodar uma vez por dia (madrugada) renovando todas as URLs antes de expirarem.

### 4. Ajuste no webhook

- No bloco que reaproveita conversa existente, refazer o fetch da foto também quando a URL atual contiver `oe=` expirado (parse simples do timestamp hex). Garante atualização passiva conforme as conversas recebem mensagem.

## Observação

Alguns contatos realmente não têm foto pública no WhatsApp (privacidade). Nesses casos o fallback com inicial continuará aparecendo — comportamento esperado.