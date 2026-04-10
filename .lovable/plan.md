

# Fix: lista de conversas mostrando "Você" em vez do nome do contato

## Causa raiz

Na Edge Function `whatsapp-webhook`, linha 390, o nome da conversa é atualizado com o `pushName` de **toda** mensagem recebida pelo webhook, incluindo mensagens `fromMe: true` (enviadas pelo celular do escritório). Quando uma mensagem é enviada pelo celular, o `pushName` é o nome do perfil WhatsApp do próprio escritório — que aparentemente é algo como "Você" ou o nome do funcionário. Isso sobrescreve o nome correto do contato.

## Solução

Adicionar a condição `!isFromMe` na verificação de atualização do nome (linha 390), para que apenas mensagens **recebidas** do contato atualizem o nome da conversa.

## Mudança

```typescript
// Antes (linha 390):
if (pushName && existingConvData?.name !== pushName) {

// Depois:
if (!isFromMe && pushName && existingConvData?.name !== pushName) {
```

Mesma condição na criação de nova conversa (linha 333): o `pushName` de mensagem `fromMe` não deve ser usado. Mas na criação, se for `fromMe`, a conversa provavelmente não existia antes — caso raro. Ainda assim, proteger com fallback.

## Correção dos dados existentes

Executar uma query para identificar conversas cujo nome foi sobrescrito. Como o nome correto está no histórico de mensagens incoming, podemos restaurar via SQL buscando o `pushName` da última mensagem incoming de cada conversa afetada. Alternativamente, a próxima mensagem incoming do contato corrigirá automaticamente o nome.

## Arquivos

| Arquivo | Mudança |
|---------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | ~1 linha — adicionar `!isFromMe` na condição de update do nome (linha 390) |

