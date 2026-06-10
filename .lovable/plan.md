## Diagnóstico

A duplicidade **não vem** do envio simultâneo Meta + Evolution. Confirmei pelos logs do banco:

- Meta API envia apenas o **template** (texto aprovado).
- Evolution envia apenas o **PDF anexo**.

O cliente recebeu 2 templates + 2 PDFs porque a obrigação FGTS tem **duas atividades WhatsApp `auto_start`** (`Enviar WhatsApp` order=3 e `Envio do FGTS` order=4), e hoje cada uma chama `sendActivityWhatsApp` enviando template + todos os anexos. Resultado: tudo dobrado.

## Comportamento desejado

Em obrigações com várias atividades WhatsApp em sequência:

- A **primeira** atividade WhatsApp do chain envia **somente o template** (sem anexos).
- As **demais** atividades WhatsApp enviam **somente os documentos anexos** (sem template).

Cada atividade marca sua própria conclusão no `obligation_activity_completions`, mantendo a rastreabilidade individual.

## Plano de correção

### 1. Distinguir o "papel" de cada atividade WhatsApp em runtime

Em `src/lib/sendActivityWhatsApp.ts`, ao iniciar `sendActivityWhatsApp`:

1. Buscar todas as atividades WhatsApp da mesma obrigação (`obligation_activities` filtrado por `obligation_id` e `type='whatsapp'`), ordenadas por `order`.
2. Calcular o índice da atividade atual dentro dessa lista.
3. Definir o modo:
   - `index === 0` → `mode = 'template_only'` (envia template, ignora anexos)
   - `index > 0`  → `mode = 'documents_only'` (envia apenas anexos, ignora template)
4. Se a obrigação tiver **apenas uma** atividade WhatsApp, manter o comportamento atual (template + anexos juntos), para não quebrar quem só configurou uma.

### 2. Ajustar o fluxo de envio conforme o modo

- `template_only`: pular completamente o loop `signedDocs`. O reconcile passa a esperar apenas o template (`expected = 1 * recipients.length`).
- `documents_only`: pular o bloco do template Meta. O reconcile passa a esperar apenas `docFilenames.length * recipients.length`.

Assim, mesmo que existam 3 atividades WhatsApp em sequência (1 template + 2 com anexos diferentes), cada uma envia o que lhe compete, sem repetir nada.

### 3. Proteção idempotente adicional na `sendActivityWhatsApp`

Antes de enviar, consultar `whatsapp_logs` para o par `(instance_id, activity_id)` e pular itens que já tenham `status='sent'` para o mesmo `recipient_phone + (template_name | media_filename)`. Isso já existe parcialmente; vou reforçar para que clique-duplo do usuário ou reexecução pelo cron nunca envie 2x o mesmo item.

### 4. Não tocar no cadastro existente

Nenhuma migration de dados. As obrigações FGTS, INSS, etc. continuam com as mesmas atividades cadastradas — apenas o runtime passa a respeitar o papel de cada uma.

### 5. Verificação

- Disparar manualmente o auto-chain de FGTS de uma instância pendente.
- Confirmar em `whatsapp_logs`: 1 linha de template + N linhas de docs (sem repetição).
- Confirmar em `chat_messages`: 1 mensagem de texto + N anexos.
- Confirmar em `obligation_activity_completions`: cada atividade WhatsApp marcada como `completed=true` individualmente.

## Arquivos a modificar

- `src/lib/sendActivityWhatsApp.ts` (lógica de modo template-only/documents-only + dedup reforçado)

Nada mais precisa mudar: as Edge Functions (`whatsapp-send`, `obligation-activity-reconcile`) já estão preparadas para receber chamadas parciais e o índice único parcial em `obligation_activity_completions` continua protegendo o marker.