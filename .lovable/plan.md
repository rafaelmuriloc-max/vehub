

# Configurar envio de templates aprovados da Meta com parametros dinamicos

## Contexto
O usuario ja tem templates aprovados na Meta (vistos nas imagens). Os templates usam variaveis no formato `{{variavel}}` como `{{tratamento_contato}}`, `{{nome_contabilidade}}`, `{{cliente}}`, `{{nome_tipo_tarefa}}`, `{{titulo_doc_anexo}}`. O codigo atual prioriza texto livre sobre template e nao envia parametros posicionais corretamente.

## Alteracoes

### 1. `src/lib/sendActivityWhatsApp.ts`
- **Priorizar template** sobre texto livre (template e obrigatorio para mensagens business-initiated)
- Quando `whatsapp_template_name` existir, enviar como `type: 'template'`
- Montar `templateParams` com componentes `body` e parametros posicionais extraidos do `whatsapp_message_body`: parsear as variaveis `{{...}}` do corpo da mensagem na ordem em que aparecem, substituir pelos valores reais, e enviar como array de parametros posicionais
- Adicionar mapeamento de variaveis `{{...}}` alem dos `[...]` existentes: `{{cliente}}` → company_name, `{{nome_tipo_tarefa}}` / `{{nome_da_obrigacao}}` → obligationName, `{{tratamento_contato}}` → contact_name, `{{nome_contabilidade}}` → nome do escritorio (buscar de `company_settings`), `{{titulo_doc_anexo}}` → obligationName, etc.
- Fallback para texto livre quando nao houver template

### 2. `supabase/functions/whatsapp-send/index.ts`
Nenhuma alteracao necessaria — ja suporta `templateParams` como `components` no payload.

### Detalhes tecnicos

No `sendActivityWhatsApp.ts`, a logica de construcao do body ficara:

```
// Buscar company_settings para nome_contabilidade
const { data: companySettings } = await supabase
  .from('company_settings').select('company_name').limit(1).single();

// Buscar nome do contato
let contactName = client?.contact_name || '';
if (departmentId) { /* usar dept contact name se existir */ }

// Mapa de variaveis {{...}}
const templateVars: Record<string, string> = {
  'tratamento_contato': contactName,
  'nome_contabilidade': companySettings?.company_name || '',
  'cliente': client?.company_name || '',
  'nome_tipo_tarefa': obligationName,
  'nome_da_obrigacao': obligationName,
  'titulo_doc_anexo': obligationName,
  'competencia': competencia,
  'vencimento': vencimento,
};

if (activity.whatsapp_template_name) {
  body.type = 'template';
  body.templateName = activity.whatsapp_template_name;
  body.templateLanguage = 'pt_BR';

  // Extrair variaveis {{...}} do corpo na ordem
  if (activity.whatsapp_message_body) {
    const matches = [...activity.whatsapp_message_body.matchAll(/\{\{(\w+)\}\}/g)];
    if (matches.length > 0) {
      body.templateParams = [{
        type: 'body',
        parameters: matches.map(m => ({
          type: 'text',
          text: templateVars[m[1]] || m[0]
        }))
      }];
    }
  }
} else if (activity.whatsapp_message_body) {
  body.type = 'text';
  body.text = replaceVariables(activity.whatsapp_message_body, variables);
}
```

Isso usa o campo `whatsapp_message_body` como "mapa" de quais variaveis o template espera e em qual ordem, extraindo `{{var}}` e mapeando para valores reais.

## Arquivo modificado
- `src/lib/sendActivityWhatsApp.ts`

