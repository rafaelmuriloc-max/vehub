## Auto-retry de atividades de envio que falharam por queda externa

### Causa-raiz (relembrando)
Em `src/lib/sendActivityWhatsApp.ts`, se qualquer documento falhar no envio (ex.: Evolution fora do ar), a função:
1. Retorna `success: false`
2. **Não grava** a `obligation_activity_completions`
3. Deixa a obrigação travada em `in_progress` para sempre — mesmo que o template Meta tenha saído e o cliente já tenha recebido o PDF por outro canal

Não existe nenhum mecanismo que volte depois para tentar de novo ou para reconciliar.

### Melhorias propostas

**1. Registrar tentativa por documento (granular)**
Hoje só temos `whatsapp_logs` por template. Vamos passar a registrar cada documento individualmente (com `instance_id`, `activity_id`, `recipient_phone`, `media_filename`, `status`, `error`). Isso permite saber exatamente o que faltou enviar.

Não cria tabela nova — usa `whatsapp_logs` adicionando os campos `activity_id`, `media_filename` e `recipient_phone` (estes dois últimos já existem informalmente em `metadata`). Apenas formalizamos o schema.

**2. Marcar a atividade como concluída quando todos os envios da atividade tiverem sucesso**
Em vez de marcar dentro de `sendActivityWhatsApp` no fim do loop (que aborta no primeiro erro), passar a marcar com base em consulta a `whatsapp_logs`:
- Conta destinatários esperados × documentos esperados
- Conta envios `status = 'sent'` para `(instance_id, activity_id)`
- Se bate, marca `obligation_activity_completions.completed = true`
- Isso roda no fim da função **e** no job de retry

**3. Edge function `obligation-activity-retry` + cron a cada 10 min**
Varre instâncias com `status = 'in_progress'` cuja(s) atividade(s) de envio (`type IN ('whatsapp','email')`) ainda não estão completed, mas têm pelo menos uma tentativa nas últimas 48h. Para cada uma:
- Identifica quais destinatários/documentos faltam (diff entre esperado e `whatsapp_logs` com `status='sent'`)
- Reexecuta só o que falta (Evolution para docs, Meta para template, SMTP para e-mail)
- Se completar 100%, grava completion → trigger recalcula para `done`
- Limite de 5 tentativas por atividade (`retry_count` em `obligation_activity_completions`); depois disso entra em estado `failed` e exige ação manual

**4. UI: badge "Reenvio pendente" no calendário**
No card da obrigação, quando o status for `in_progress` por causa de falha de envio (detectado via `whatsapp_logs` com `status='failed'` recente), mostrar um pill laranja "Reenvio automático em andamento" com tooltip explicando. Resolve a confusão visual de "está com documento mas tá pendente".

**5. Botão "Forçar conclusão"** (admin only)
Quando a atividade já teve template enviado mas o(s) documento(s) falham repetidamente (5 tentativas), exibir botão "Marcar como concluída manualmente" — registra a completion com `notes = 'manual_override:<motivo>'` e libera a obrigação. É o que estamos fazendo manualmente hoje via SQL; vira ação de 1 clique.

### Arquivos afetados

```text
supabase/migrations/<ts>_whatsapp_logs_granular.sql   (novo)
  - ALTER TABLE whatsapp_logs ADD COLUMN activity_id uuid, media_filename text, recipient_phone text
  - ALTER TABLE obligation_activity_completions ADD COLUMN retry_count int DEFAULT 0, last_retry_at timestamptz, failure_reason text

supabase/functions/obligation-activity-retry/index.ts  (novo)
  - cron 10/10 min via pg_cron (insert tool)

src/lib/sendActivityWhatsApp.ts                       (refactor)
  - grava whatsapp_logs por doc/destinatário
  - completion baseada em conferência, não em flag local
  - não aborta o loop ao primeiro erro (segue tentando os outros docs/destinatários)

src/lib/sendActivityEmail.ts                          (mesma ideia, menor)

src/components/ClientObligationsTab.tsx               (badge "reenvio pendente" + botão admin)
src/pages/CalendarView.tsx                            (mesmo badge no card)
```

### O que NÃO muda
- Trigger `recalc_obligation_instance_status` continua igual (já é a fonte de verdade do status)
- Templates Meta, Evolution API e SMTP continuam os mesmos
- Nada quebra para obrigações que não dependem de envio (continuam fechando normal pelo upload)

### Resultado
Quedas pontuais da Evolution/SMTP/Meta deixam de travar obrigações. O sistema reenvia sozinho em até 10 min, e quando não conseguir após 5 tentativas, o admin tem 1 clique para resolver — sem precisar mexer no banco.
