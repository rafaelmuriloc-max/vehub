
## Objetivo
Executar uma única vez: reenviar via Evolution API apenas os anexos das instâncias do DAS Simples Nacional da competência **05/2026** que têm arquivo salvo mas cuja atividade de WhatsApp não está concluída.

## Como vou rodar
Script Node/TS one-shot via `code--exec`, usando `SUPABASE_SERVICE_ROLE_KEY` e os secrets atuais da Evolution (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`). Nenhum arquivo do projeto será criado/alterado.

## Passos do script
1. Localizar a obrigação "DAS Simples Nacional" (`obligations` por `name ILIKE '%DAS%Simples%'`) e suas atividades (`obligation_activities`).
2. Identificar a atividade do tipo `whatsapp`.
3. Buscar `obligation_instances` com `reference_month = '2026-05-01'` para essa obrigação.
4. Para cada instância:
   - Listar `obligation_activity_completions` da instância.
   - Verificar: existe pelo menos 1 completion com `file_url` (anexo salvo) E a atividade WhatsApp NÃO está `completed = true`.
   - Se sim → entra no lote.
5. Para cada instância elegível:
   - Resolver destinatários: `client_department_contacts` (departamento da obrigação) ou fallback `clients.contact_phone`.
   - Para cada `file_url`, gerar signed URL do bucket `documents` (7 dias).
   - Enviar cada documento via Evolution: `POST {EVOLUTION_API_URL}/message/sendMedia/{INSTANCE_NAME}` com `mediatype: 'document'`, `media: <signedUrl>`, `fileName`, `number: <phone>`.
   - Após sucesso em todos os anexos da instância, marcar a atividade WhatsApp como concluída (`obligation_activity_completions` upsert: `completed = true`, `completed_at = now()`).
6. Imprimir relatório: total de instâncias processadas, sucessos, falhas (com motivo por cliente/arquivo). Nenhuma exclusão ou alteração além das completions marcadas.

## Antes de executar
Primeiro vou rodar apenas a etapa de **descoberta** (dry-run) — listar os clientes/anexos que entrariam no envio — e te mostrar para você confirmar antes do envio real.
