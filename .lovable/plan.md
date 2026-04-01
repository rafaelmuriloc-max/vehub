

# Separar lógica de documento no header vs botão com link no WhatsApp

## Problema
O template WhatsApp configurado envia o **documento diretamente** (header tipo DOCUMENT), mas **não possui botão com link**. Atualmente o código só envia o header de documento quando `whatsapp_button_url` está preenchido, o que impede o envio do documento no template correto.

## Solução
Adicionar um campo booleano `whatsapp_has_document_header` na tabela `obligation_activities` para indicar se o template espera um documento no header. Isso desacopla a lógica do header de documento da lógica do botão URL.

## Alterações

### 1. Migração SQL
```sql
ALTER TABLE obligation_activities 
  ADD COLUMN whatsapp_has_document_header boolean NOT NULL DEFAULT false;
```

### 2. `src/lib/sendActivityWhatsApp.ts`
Mudar a condição do header de documento (linha 129):
- **Antes**: `hasDocuments && ... && activity.whatsapp_button_url`
- **Depois**: `hasDocuments && ... && activity.whatsapp_has_document_header`

A lógica do botão URL (linhas 168-177) continua independente, condicionada apenas a `whatsapp_button_url`.

### 3. `src/pages/Obligations.tsx`
- Adicionar `whatsapp_has_document_header` ao tipo `Activity`, ao form state e ao payload de save
- Adicionar um checkbox "Template com documento no header" no formulário de atividade WhatsApp

### 4. `src/pages/CalendarView.tsx` e `src/components/ClientObligationsTab.tsx`
- Adicionar `whatsapp_has_document_header` ao tipo `Activity` e à query select

### 5. `src/integrations/supabase/types.ts`
- Adicionar campo ao tipo da tabela `obligation_activities`

## Arquivos
- Migração SQL (nova)
- `src/lib/sendActivityWhatsApp.ts`
- `src/pages/Obligations.tsx`
- `src/pages/CalendarView.tsx`
- `src/components/ClientObligationsTab.tsx`
- `src/integrations/supabase/types.ts`

