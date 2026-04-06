

# Corrigir bloqueio de envio de WhatsApp pela trava de duplicidade

## Problema
A trava de duplicidade adicionada na última alteração está **bloqueando todos os envios** de WhatsApp. O código verifica se já existe um registro em `whatsapp_logs` com `instance_id + template_name + status='sent'` e, se existir, retorna silenciosamente `{ success: true }` sem enviar nada.

Como a instância do FGTS para RMC GESTAO já tem 6 registros anteriores com `status=sent`, a trava impede qualquer novo envio — tanto automático (auto_start) quanto manual.

## Solução
Substituir a trava absoluta por uma trava temporal: só bloquear se já existe um envio com `status=sent` nos últimos 2 minutos para a mesma `instance_id + template_name`. Isso previne disparos rápidos duplicados (o problema original) mas permite reenvios legítimos.

## Alteração técnica

### Arquivo: `src/lib/sendActivityWhatsApp.ts`
Alterar a query de verificação (linhas 35-46) para incluir um filtro temporal:

```typescript
const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
const { data: alreadySent } = await supabase
  .from('whatsapp_logs')
  .select('id')
  .eq('instance_id', instanceId)
  .eq('template_name', activity.whatsapp_template_name || '')
  .eq('status', 'sent')
  .gte('created_at', twoMinutesAgo)
  .limit(1);
```

Isso mantém a proteção contra envios duplicados rápidos mas permite reenvios após 2 minutos.

## Arquivo alterado
- `src/lib/sendActivityWhatsApp.ts` — ~2 linhas alteradas

