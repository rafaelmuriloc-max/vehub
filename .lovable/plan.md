## Causa raiz

Ao criar uma conversa digitando o telefone na janela "Nova Conversa", você digitou `47984398434` (11 dígitos, sem o código do país). O `NewConversationDialog` salva o `whatsapp_phone` exatamente como digitado:

```
chat_conversations.whatsapp_phone = "47984398434"
```

Quando o destinatário responde, o WhatsApp/Evolution entrega o JID no formato internacional `5547984398434@s.whatsapp.net`. O `whatsapp-webhook` então procura a conversa existente usando variantes de telefone:

```ts
// supabase/functions/whatsapp-webhook/index.ts
const phoneVariants = getPhoneVariants(phoneRaw); // entrada: "5547984398434"
// gera: ["5547984398434", "554784398434"]  ← sem o "47984398434" salvo
```

Como nenhuma variante bate com `"47984398434"`, o webhook não encontra a conversa existente e **cria uma nova** — exatamente o comportamento que você viu no print (uma conversa "+47984398434" enviada por você + outra criada na resposta).

O envio funciona porque o `whatsapp-send-text` faz o ajuste oposto antes de chamar a Meta API:

```ts
let metaPhone = phone.replace(/\D/g, "");
if (!metaPhone.startsWith("55")) metaPhone = "55" + metaPhone; // adiciona 55
```

Ou seja: o envio normaliza, mas a gravação não → desencontro com a resposta.

## Correção

Aplicar a mesma normalização do webhook no momento de **criar** a conversa pelo telefone digitado, para que o `whatsapp_phone` salvo seja sempre o canônico (13 dígitos: `55 + DDD + 9 + número`).

### 1. `src/components/chat/NewConversationDialog.tsx`

a) Adicionar função `canonicalizePhone` espelhando o webhook:
- remove tudo que não é dígito
- se tem 10 ou 11 dígitos (DDD + número), prefixa `55`
- se ficar com 12 dígitos `55 + DDD + 8 dígitos` e o local começar em 6/7/8/9, insere o `9` depois do DDD
- garante saída em formato canônico de 13 dígitos quando aplicável

b) Em `startConversation`, antes do lookup e do insert:
```ts
const canonicalPhone = canonicalizePhone(contact.phone);
const variants = phoneVariants(canonicalPhone); // 13 e 12 dígitos
```

c) Buscar conversa existente por **qualquer variante** (não só o exato), usando `.in('whatsapp_phone', variants)` em vez do filtro client-side estrito atual.

d) Salvar `whatsapp_phone: canonicalPhone` (13 dígitos, sem `+`, sem máscara) e `name: '+' + canonicalPhone` quando o contato veio só de telefone digitado.

### 2. (Opcional, recomendado) Migração de dados

Atualizar conversas já gravadas com telefone curto para o formato canônico, para que respostas futuras delas batam:

```sql
UPDATE chat_conversations
SET whatsapp_phone = '55' || regexp_replace(whatsapp_phone, '\D', '', 'g')
WHERE whatsapp_phone IS NOT NULL
  AND length(regexp_replace(whatsapp_phone, '\D', '', 'g')) IN (10, 11)
  AND regexp_replace(whatsapp_phone, '\D', '', 'g') NOT LIKE '55%';
```

(Adicionalmente, mesclar manualmente a conversa duplicada criada agora — ou deixar como está; o webhook tem lógica de "merge" que pode unificar em mensagens futuras.)

## Resumo

- **Problema:** conversa salva como `47984398434`; webhook recebe `5547984398434` e não consegue casar → cria nova conversa.
- **Fix:** canonicalizar o telefone (prefixar `55`, garantir o `9`) ao criar a conversa pelo dialog, e buscar duplicidade por todas as variantes.
- **Arquivo principal alterado:** `src/components/chat/NewConversationDialog.tsx`.
- **Migração opcional:** normalizar registros antigos em `chat_conversations.whatsapp_phone`.
