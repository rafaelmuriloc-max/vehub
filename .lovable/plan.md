## Objetivo

Reorganizar o envio das obrigações no WhatsApp:

1. **Mensagem de texto** continua via **template da Meta** (`whatsapp-send` com `templateName` / `templateParams`), **sempre sem header de documento**.
2. **Todos os documentos anexados** (1 ou N) passam a sair via **Evolution API** (`whatsapp-send-media`), uma mensagem por arquivo.
3. **Anti-race**: o chain de auto-start (WhatsApp, E-mail) só dispara quando **todas as atividades `document` anteriores** já tiverem completion confirmada no banco. Subir só o PIS (ou só o COFINS) não dispara nada — só ao subir o último anexo.

## Por que isso resolve os bugs reportados

- **Pousada Caminho dos Sonhos**: a obrigação ficou aberta porque o front fechou antes de marcar "Envia Email". O anti-race garante que o chain rode uma vez só (após o 2º upload), reduzindo a janela de falha; além disso a completion do e-mail continua sendo gravada pelo helper como hoje.
- **Cowboy / Coração do Parque / Bela Vista**: o chain disparou no 1º upload (COFINS) e mandou só ele. Com o anti-race, o disparo só acontece quando PIS **e** COFINS estiverem anexados → ambos saem juntos.

## Mudanças

### 1) `src/lib/sendActivityWhatsApp.ts`
- Remover qualquer lógica de header de documento no template Meta (atual `needsMultiSend` e header `document` na 1ª chamada).
- Fluxo novo, por destinatário:
  1. Buscar os anexos da obrigação (mesma query atual: `obligation_activity_completions` da instance, filtradas pelas atividades `type='document'`, com `file_url` válido).
  2. Disparar **1×** `whatsapp-send` (template Meta, sem header) com os `templateParams` atuais.
  3. Para cada anexo, invocar `whatsapp-send-media` (Evolution) passando `to`, `mediaUrl` (URL assinada 7d), `mediaType:'document'`, `fileName`, `clientId`, `obligationId`, `instanceId`. Sem fallback para Meta.
  4. Só marca completion (e dedup-log em `whatsapp_logs`) se template + todos os docs retornarem sucesso. Qualquer falha de doc devolve `success:false` com a lista de erros e **não** conclui a atividade.

### 2) `src/components/ClientObligationsTab.tsx` e `src/components/tasks/TaskEditDialog.tsx`
- Antes do auto-start chain (em `toggleCompletion` e em `handleFileUpload`), recarregar completions do banco e bloquear avanço se houver atividade `document` anterior sem completion:
  ```ts
  const { data: live } = await supabase
    .from('obligation_activity_completions')
    .select('activity_id, completed')
    .eq('instance_id', instanceId);
  const pendingDoc = oblActivities
    .filter(a => a.type === 'document' && a.order < nextAct.order)
    .some(a => !live?.find(c => c.activity_id === a.id && c.completed));
  if (pendingDoc) break;
  ```

### 3) `supabase/functions/whatsapp-send-media/index.ts`
- Sem mudança estrutural (já suporta Evolution e Meta). Apenas garantir que aceita `instanceId`, `clientId`, `obligationId` no body e registra em `whatsapp_logs`. Se faltar, adicionar.

### 4) Reparo dos casos atuais (migration única)
- Inserir completion da atividade "Envia Email" (`d8a587d7-e88a-41ef-8513-c120f0227b0e`) na instance da Caminho dos Sonhos (`7a2d971c-00c3-41cc-9a9e-66ea790884e8`) — o e-mail já saiu (log `opened`) e isso fecha a obrigação.
- Para Cowboy / Coração do Parque / Bela Vista o usuário reenvia o DARF PIS manualmente (obrigações já estão `done`).

## Fora de escopo

- Não muda `sendActivityEmail.ts`.
- Não muda templates Meta cadastrados.
- Não toca em `services_suspended` nem na aba "Suspensos".

## Validação

- Subir só PIS → nada é enviado.
- Subir COFINS depois → 1 template Meta (texto) + 2 documentos via Evolution + 1 e-mail com 2 anexos → atividades de WhatsApp/E-mail concluídas → obrigação `done`.
- Obrigação de 1 doc só → template Meta + 1 documento via Evolution (mesmo caminho, sem ramificação).
- Inverter a ordem dos uploads → mesmo resultado.
