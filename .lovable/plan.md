

# Integração WhatsApp Meta API — Envio Automático em Obrigações

## Resumo
Usar a API oficial da Meta apenas para envio automático de mensagens WhatsApp nas atividades de obrigações (mesmo fluxo do auto_start de e-mail). Mensagens manuais ficam para configuração futura via EvolutionAPI.

## 1. Secrets — credenciais Meta
Solicitar ao usuário via ferramenta de secrets:
- `WHATSAPP_ACCESS_TOKEN` — token permanente da Meta
- `WHATSAPP_PHONE_NUMBER_ID` — ID do número de telefone

## 2. Migração SQL — tabela `whatsapp_logs`
```sql
CREATE TABLE public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  obligation_id uuid,
  instance_id uuid,
  recipient_phone text NOT NULL,
  template_name text,
  template_params jsonb,
  body_text text,
  status text NOT NULL DEFAULT 'sent',
  wamid text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view" ON public.whatsapp_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (true);
```

## 3. Colunas WhatsApp na `obligation_activities`
Adicionar campos para configurar a mensagem WhatsApp na atividade:
```sql
ALTER TABLE public.obligation_activities
  ADD COLUMN whatsapp_template_name text,
  ADD COLUMN whatsapp_message_body text;
```

## 4. Edge Function `whatsapp-send`
Nova função `supabase/functions/whatsapp-send/index.ts`:
- Aceita `to`, `type` (template ou text), `templateName`, `templateLanguage`, `templateParams`, `text`, `clientId`, `obligationId`, `instanceId`
- Chama `POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages` com `Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}`
- Registra em `whatsapp_logs`
- Retorna `wamid`

## 5. Lib `sendActivityWhatsApp.ts`
Criar `src/lib/sendActivityWhatsApp.ts` similar ao `sendActivityEmail.ts`:
- Busca telefone do contato do cliente (via `client_department_contacts.contact_phone` com fallback para `clients.contact_phone`)
- Substitui variáveis no corpo da mensagem
- Chama `whatsapp-send` edge function
- Marca atividade como concluída

## 6. Configuração na página Obrigações
No dialog de atividade, quando tipo = `whatsapp`:
- Campo "Nome do Template" (opcional — se preenchido, envia como template)
- Campo "Corpo da mensagem" (texto livre com variáveis `[Nome_da_Empresa]`, `[Competencia]`, etc.)
- Badges de variáveis clicáveis (mesmo padrão do e-mail)

## 7. Integração no auto_start chain
Em `CalendarView.tsx` e `ClientObligationsTab.tsx`, adicionar tratamento para `nextAct.type === 'whatsapp'` na cadeia de auto_start:
- Se tem `whatsapp_template_name` ou `whatsapp_message_body`, chama `sendActivityWhatsApp()`
- Toast de sucesso/erro
- Se sem config completa, para a cadeia (mesmo comportamento do e-mail)

## Arquivos criados/modificados
- **Secrets**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- **Migração SQL**: tabela `whatsapp_logs` + colunas em `obligation_activities`
- `supabase/functions/whatsapp-send/index.ts`
- `src/lib/sendActivityWhatsApp.ts`
- `src/pages/Obligations.tsx` — campos WhatsApp no dialog de atividade
- `src/pages/CalendarView.tsx` — auto_start chain para WhatsApp
- `src/components/ClientObligationsTab.tsx` — auto_start chain para WhatsApp

