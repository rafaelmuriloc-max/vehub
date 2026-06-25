
---

## PIS/COFINS — guia do PIS não enviada

### Diagnóstico (logs)
Para várias empresas na competência 05/2026 (GOLDEN GREN, LBV, OCEAN SIGNATURE, FONTE DELLA VITA, …), os `whatsapp_logs` mostram que apenas o PDF do **COFINS** foi enviado pela atividade "Envia Darf WhatsApp" (`07869e4e-2471-40ee-957b-bbd6d94998ef`). Não há log de envio do PDF do PIS.

Cronologia em GOLDEN GREN (instance `44ac9660-…`):
- 12:51:37 — `DARF COFINS` marcado completo + `file_url` preenchido (upload via página **Documentos**)
- 12:51:39 — `Envia WhatsApp` (template) disparado automaticamente
- 12:51:42 — `Envia Darf WhatsApp` disparado → envia **apenas** o COFINS (único anexo presente)
- 12:51:50 — `Envia Email` disparado
- 12:52:20 — `DARF PIS` marcado completo + `file_url` (upload do PIS chegou ~40s depois)

### Causa raiz
`src/pages/Documents.tsx` (linhas ~574-603) dispara a cadeia `auto_start` logo após associar um documento a uma instância, **sem** o "anti-race" que existe em `ClientObligationsTab.tsx` (linhas ~183-195 e 274-286). Esse anti-race bloqueia a próxima atividade quando ainda há *outra* atividade do tipo `document` anterior na ordem sem `file_url`. Como faltava no Documents.tsx, o upload do COFINS (order 2) disparou as atividades WhatsApp/Email mesmo com PIS (order 1) ainda não anexado.

Adicionalmente, quando o PIS é enviado depois, a cadeia até re-roda, mas a atividade `Envia Darf WhatsApp` já está marcada `completed=true` → a checagem `if (nextComp?.completed) break;` impede o reenvio. Resultado: PIS nunca sai.

### Fix
1. **`src/pages/Documents.tsx`** (loop `for (let ai = actIdx + 1 …)`):
   - Adicionar a mesma checagem `priorDocs` usada em `ClientObligationsTab.tsx`: buscar `obligation_activity_completions` da instância e, se algum doc com `order < nextAct.order` estiver sem `file_url`, dar `break`.
   - Pular (`continue`) a atividade se o marker dela já tiver `completed=true` (evita disparar errado quando o doc faltante chegou depois).

2. **Reconciliação dos casos já afetados** (competência 05/2026):
   - Para cada instância em que existe `obligation_activity_completions` com `file_url` contendo `_PIS_` mas NÃO existe log `status='sent'` com `media_filename ILIKE '%PIS%'` na atividade `07869e4e-…`:
     - Resetar o marker (`file_url IS NULL`) da atividade `07869e4e-…` para `completed=false, completed_at=null`.
     - Chamar `sendActivityWhatsApp` (via botão "Reprocessar fluxo" já existente em SimplesNacional — não, esta é PIS/COFINS) → vou criar um SQL que apenas reseta o marker e instruir o usuário a clicar manualmente em "Reprocessar" / completar a atividade anterior; OU melhor: chamar a função diretamente via script.
   - Pelo padrão já adotado no projeto, o caminho mais limpo é: resetar o marker da atividade `07869e4e` (Envia Darf WhatsApp) e re-disparar a cadeia rodando `sendActivityWhatsApp` em background para cada instância afetada. A própria função já deduplica pelo `whatsapp_logs.status='sent'`, então só vai mandar o PIS (COFINS já tem log `sent`).

### Arquivos a alterar
- `src/pages/Documents.tsx` — adicionar anti-race + skip-completed.
- Migration ad-hoc (SQL) — resetar markers da atividade `07869e4e-…` nas instâncias 05/2026 cujo PIS não foi enviado, para permitir reenvio.
## Problema

Quando o cliente usa a função **Responder** do WhatsApp, a mensagem chega no painel mas **sem a citação** da mensagem original. No banco, mensagens `whatsapp_incoming` recentes estão todas com `reply_to_id = NULL` e `reply_to_snapshot = NULL`, mesmo quando o cliente claramente respondeu uma mensagem.

O webhook (`supabase/functions/whatsapp-webhook/index.ts`) já tem extração de reply a partir de `contextInfo.stanzaId` / `contextInfo.quotedMessage`, mas:

1. O `console.log("Webhook received:", ...)` está truncado em **500 caracteres** — não dá pra confirmar pelos logs se a Evolution está enviando o `quotedMessage` para essas mensagens (a parte interessante vem depois dos 500 chars).
2. A busca atual cobre `extendedTextMessage.contextInfo`, `imageMessage.contextInfo`, etc. e `messageContextInfo`, mas pode estar faltando algum caminho que a Evolution está usando agora (ex.: `senderKeyDistributionMessage` envelopando, `protocolMessage`, `pollUpdateMessage`, ou `contextInfo` aninhado dentro de `documentWithCaptionMessage`).
3. O lookup do original usa `wa_evolution_id = quotedStanzaId`. Para mensagens enviadas via Meta Cloud API por nós, o `wa_message_id` é o `wamid.HBg...` da Meta, mas o `wa_evolution_id` pode estar **vazio**, então mesmo se o cliente responder a uma mensagem nossa enviada via Meta, o lookup falha — e ainda não cai no fallback do `reply_to_snapshot` porque o `if (original)` é satisfeito antes (ou não, dependendo). Hoje só cai no fallback quando `original` é null, **mas** se o cliente respondeu a mensagem nossa enviada pela Meta, o stanzaId que a Evolution recebe pode ser o próprio wamid da Meta — precisa verificar.

## Solução

### 1. Diagnóstico via logs (passo curto antes do fix)
Em `supabase/functions/whatsapp-webhook/index.ts`:
- Trocar `JSON.stringify(payload).substring(0, 500)` por `substring(0, 5000)` para o log de "Webhook received" (revertível depois).
- Adicionar log explícito do `messageObj` (após o unwrap) com `JSON.stringify(messageObj).substring(0, 3000)` quando `key.fromMe === false`, para vermos a estrutura real de uma reply.
- No bloco de "Reply lookup", logar também o `wa_evolution_id` e o `wa_message_id` candidatos buscados.

Pedir ao usuário para fazer o teste (cliente respondendo uma mensagem nossa) — com os logs detalhados conseguimos identificar exatamente onde está o `quotedMessage`.

### 2. Tornar a extração mais robusta
Ainda assim, antes do retorno do diagnóstico, já vamos:

- Adicionar mais caminhos para `ctxInfo`:
  ```ts
  const ctxInfo =
    messageObj.extendedTextMessage?.contextInfo ||
    messageObj.imageMessage?.contextInfo ||
    messageObj.videoMessage?.contextInfo ||
    messageObj.audioMessage?.contextInfo ||
    messageObj.documentMessage?.contextInfo ||
    messageObj.stickerMessage?.contextInfo ||
    messageObj.contactMessage?.contextInfo ||
    messageObj.locationMessage?.contextInfo ||
    messageObj.buttonsResponseMessage?.contextInfo ||
    messageObj.listResponseMessage?.contextInfo ||
    messageObj.templateButtonReplyMessage?.contextInfo ||
    messageObj.messageContextInfo?.quotedMessage ? messageObj.messageContextInfo : null ||
    (data as any).contextInfo ||
    null;
  ```
- Buscar o original tanto por `wa_evolution_id = quotedStanzaId` **quanto** por `wa_message_id = quotedStanzaId` (com OR), para cobrir mensagens enviadas via Meta Cloud API.
- Quando a busca local não acha nenhum original mas o payload trouxe `ctxInfo.quotedMessage`, **sempre** popular o `reply_to_snapshot` a partir do quotedMessage (o fallback já existe, mas vamos garantir que `reply_to_id` fique null sem bloquear o snapshot).
- Detectar se a quoted é nossa via `ctxInfo.participant` vazio/igual ao número do escritório (`isFromUs = !participant || participant === ourNumber`) e definir `message_type` do snapshot como `whatsapp_outgoing` quando for o caso, para a bolha de citação renderizar com o estilo correto.

### 3. Validação
1. Aguardar reprodução pelo usuário (cliente responde uma mensagem).
2. Consultar `chat_messages` filtrando a `wa_message_id` correspondente — `reply_to_snapshot` deve estar preenchido.
3. Conferir na UI se a citação aparece acima do texto da resposta.
4. Depois de confirmar, reduzir o log de payload de 5000 para 500 chars novamente.

### Fora de escopo
- Não mudar a UI do `MessageBubble` (a renderização do `replySnapshot` já existe e funciona — basta os dados chegarem).
- Não mexer em envios outgoing (`whatsapp-send-text`), apenas no recebimento.
