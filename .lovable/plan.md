# Reenviar DAS para Josilene e corrigir bug do fluxo automático

## Diagnóstico
- Cliente: `18.299.564 JOSILENE DOS SANTOS` (id `24c1ae8b…`).
- Instância DAS 05/2026 (`bc67c5f9…`).
- Logs (`whatsapp_logs`):
  - 17:45:25 — template `send_output_informations_template_3_header` → **enviado** (5547988315698).
  - 17:45:26 — template idem → **enviado** (47988315698).
  - 17:45:28 — atividade "Envio DAS" (documento `032026_-_MEI_-_JOSILENE…pdf`) → **falhou** com `Edge Function returned a non-2xx status code`.
- Às 18:19 o arquivo correto (`052026_…pdf`) foi reanexado. A atividade `Envio DAS` consta como `completed=true` desde 17:47 (antes da reanexação), por isso o fluxo automático **não disparou de novo** e o documento de maio nunca foi entregue.
- Causa raiz dupla:
  1. O documento de março falhou no Evolution (provavelmente URL assinada inválida ou número, mas o detalhe foi perdido — `sendActivityWhatsApp` registra só "non-2xx").
  2. A atividade foi marcada como concluída mesmo após a falha do documento, então a reanexação posterior não rerodou a cadeia.

## O que será feito

### 1. Reenviar agora o DAS de Josilene (05/2026)
- Apagar (ou marcar `failed`) o log de falha de 17:45:28 para liberar o resend.
- Resetar a atividade "Envio DAS" (`6cbbd025…`) para `completed=false` na instância `bc67c5f9…`.
- Abrir a obrigação no cliente Josilene → clicar em **Reprocessar fluxo** (dialog `ReprocessChainDialog` já existente) para a competência 05/2026; isso reaproveita o template já enviado e dispara o documento de maio.

### 2. Corrigir a marcação indevida de "concluído" após falha
Em `src/lib/sendActivityWhatsApp.ts` → `reconcileActivityCompletion`:
- Quando `sendMode === 'documents_only'` e há `recipients × docs` esperados, se `sentCount < expected`, NUNCA marcar a completion como `completed=true`. O bug atual é que, se a completion já existir com `completed=true` (vinda do upload do arquivo), o caminho de falha só atualiza `failure_reason` mas o registro continua `completed=true`. Vamos forçar `completed=false` na linha "marker" quando houver falha pendente.
- Adicionar `console.error` com o JSON de erro do Evolution (`details`) capturado em `whatsapp-send` para que o `error_message` salvo em `whatsapp_logs` traga a causa real, e não só "non-2xx".

### 3. Hardening do `sendActivityWhatsApp`
- Ao invocar `whatsapp-send`, capturar `data?.error`/`data?.details` e passar como `error_message` mais informativa no `logWhatsappSend` (em vez de só `error.message` da invoke).

## Arquivos alterados
- `src/lib/sendActivityWhatsApp.ts` (correções 2 e 3).
- Operações pontuais no banco (reset da completion e do log) — feitas via migration efêmera ou via SQL administrativo dentro do build.

## Fora de escopo
- Reescrever todo o fluxo de cadeia auto_start.
- Aplicar a outros clientes — apenas Josilene neste round; o restante já foi tratado no Reprocessar fluxo geral.