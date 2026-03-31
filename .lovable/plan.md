

# Rastreamento de abertura de e-mail (tracking pixel)

## Resumo
Registrar quando o destinatário abre um e-mail, atualizando o status para "opened" e salvando data/hora da abertura. Usa a técnica de "tracking pixel" — uma imagem invisível 1x1 embutida no HTML do e-mail que, ao ser carregada, aciona uma Edge Function que atualiza o registro.

## 1. Migração SQL — nova coluna `opened_at`
```sql
ALTER TABLE public.email_logs ADD COLUMN opened_at timestamptz;

CREATE POLICY "Service can update email_logs" ON public.email_logs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```
- Também precisamos permitir update anônimo (público) para o tracking pixel funcionar sem auth:
```sql
CREATE POLICY "Public can update opened_at" ON public.email_logs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

## 2. Nova Edge Function `email-track`
- Recebe `?id=<email_log_id>` via GET
- Usa service role para fazer `UPDATE email_logs SET opened_at = now(), status = 'opened' WHERE id = :id AND opened_at IS NULL`
- Retorna uma imagem 1x1 transparente (GIF) com `Content-Type: image/gif`
- Sem autenticação necessária (é chamado pelo cliente de e-mail do destinatário)

## 3. Inserir tracking pixel nos e-mails enviados
- **`src/pages/Email.tsx`**: após inserir o `email_log`, pegar o `id` retornado e injetar no HTML antes do envio: `<img src="https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/email-track?id=LOG_ID" width="1" height="1" style="display:none" />`
- Ajuste na ordem: primeiro inserir o log (para ter o id), depois injetar o pixel no HTML, depois enviar via `smtp-send`
- **`src/lib/sendActivityEmail.ts`**: mesma lógica — inserir log primeiro, injetar pixel, depois enviar
- **`src/components/EmailComposeDialog.tsx`**: mesma lógica se envia e-mails diretamente

## 4. Exibir status "Aberto" na lista de enviados
- **`src/pages/Email.tsx`**: na tabela de enviados, atualizar o Badge para mostrar "Aberto" (azul) quando `status === 'opened'`, além de exibir a coluna `opened_at` formatada
- Adicionar coluna "Aberto em" na tabela

## Arquivos modificados
- **Migração SQL** — coluna `opened_at` + policy de update
- **Nova Edge Function** `supabase/functions/email-track/index.ts`
- `src/pages/Email.tsx` — reordenar fluxo de envio + coluna "Aberto em"
- `src/lib/sendActivityEmail.ts` — injetar pixel no envio automático
- `src/components/EmailComposeDialog.tsx` — injetar pixel se aplicável

## Detalhes técnicos
- O tracking pixel só registra a primeira abertura (`WHERE opened_at IS NULL`)
- Clientes de e-mail que bloqueiam imagens não dispararão o tracking (limitação conhecida)
- A Edge Function `email-track` não requer autenticação — é pública por design
- O GIF 1x1 transparente é um binário de 43 bytes hardcoded na função

