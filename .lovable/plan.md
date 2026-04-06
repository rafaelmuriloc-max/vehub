

# Diagnóstico: documento do FGTS não chega via WhatsApp

## Situação atual

Analisei exaustivamente os dados e o código. A configuração do FGTS é **idêntica** à da Folha de Pagamento:
- Mesmo template `envio_doc`
- Mesmo `whatsapp_has_document_header = true`
- Mesmo código `sendActivityWhatsApp.ts`
- Mesma Edge Function `whatsapp-send`

A Meta API **aceita** ambos os envios e retorna `wamid` de confirmação. A diferença é que a Folha entrega e o FGTS não.

## Problemas identificados

### 1. Envio triplo do FGTS para o mesmo número
O FGTS para RMC GESTAO foi enviado **3 vezes** (22:44, 22:49, 22:52) para o mesmo número. Isso indica que a cadeia `auto_start` está sendo acionada múltiplas vezes. Enviar muitos templates em sequência para o mesmo número pode causar bloqueio de entrega na Meta (rate limiting silencioso — a API aceita mas não entrega).

### 2. Sem logging detalhado
A Edge Function `whatsapp-send` não registra o payload enviado nem o response body completo da Meta. Sem isso, não é possível identificar se a Meta está retornando warnings de delivery ou detalhes de falha.

## Plano de ação

### Etapa 1 — Adicionar logging detalhado na Edge Function `whatsapp-send`
Registrar:
- O `messagePayload` completo enviado à Meta
- O response body completo da Meta (não apenas o wamid)
- O status HTTP da resposta

Isso permitirá ver exatamente o que a Meta está respondendo para os envios de FGTS vs Folha.

### Etapa 2 — Evitar envio duplicado
Adicionar verificação no `sendActivityWhatsApp.ts` para checar se já existe um `whatsapp_logs` com `status = 'sent'` para a mesma `instance_id` e `activity_id` antes de enviar. Isso previne o envio triplo.

## Arquivos alterados
- `supabase/functions/whatsapp-send/index.ts` — ~4 linhas de logging
- `src/lib/sendActivityWhatsApp.ts` — ~8 linhas de verificação de duplicidade

