

# Gerar URL pública dos documentos da obrigação para o botão do WhatsApp

## Resumo
Criar uma Edge Function pública que gera URLs assinadas temporárias para os documentos anexados a uma obrigação. No momento do envio do WhatsApp, buscar automaticamente os documentos da instância e montar a URL do botão apontando para essa Edge Function.

## Como funciona hoje
- Documentos são armazenados no bucket privado `documents` com path `{clientId}/{instanceId}/{activityId}/{filename}`
- O campo `file_url` em `obligation_activity_completions` guarda o path do arquivo
- O campo `whatsapp_button_url` é manual (preenchido no formulário)

## O que vai mudar

### 1. Nova Edge Function: `document-public-link`
- Recebe `instanceId` como query param (sem autenticação - público)
- Busca os `obligation_activity_completions` com `file_url` preenchido para aquele `instance_id`
- Gera signed URLs (válidas por 7 dias) para cada documento
- Retorna uma página HTML simples listando os documentos com links para download
- URL exemplo: `https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/document-public-link?instance=xxx`

### 2. Atualizar `src/lib/sendActivityWhatsApp.ts`
- Antes de montar o payload, buscar os `obligation_activity_completions` com `file_url` preenchido para o `instanceId`
- Se existirem documentos, gerar automaticamente a URL do botão apontando para a Edge Function `document-public-link`
- Isso substitui o campo manual `whatsapp_button_url` — o sistema monta a URL automaticamente
- Se não houver documentos anexados, não incluir o componente button

### 3. Remover campo manual (opcional)
- O campo "URL do Botão" no formulário de atividade pode ser mantido como fallback, mas o sistema priorizará a URL automática quando houver documentos anexados

## Detalhes técnicos

**Edge Function `document-public-link`** (pública, sem JWT):
```text
GET /document-public-link?instance={instanceId}

1. Valida instanceId (UUID)
2. Busca completions com file_url para essa instância (service role)
3. Busca dados do cliente e obrigação para exibir no HTML
4. Gera signedUrls (7 dias) para cada arquivo
5. Retorna HTML com links de download estilizado
```

**Lógica em `sendActivityWhatsApp.ts`**:
```text
// Buscar documentos anexados à instância
const { data: docs } = await supabase
  .from('obligation_activity_completions')
  .select('file_url')
  .eq('instance_id', instanceId)
  .not('file_url', 'is', null);

// Se há documentos, montar URL automática do botão
if (docs && docs.length > 0) {
  const publicUrl = `https://ismgjjvarzzfsbdpthot.supabase.co/functions/v1/document-public-link?instance=${instanceId}`;
  components.push({
    type: 'button', sub_type: 'url', index: '0',
    parameters: [{ type: 'text', text: instanceId }]
  });
}
```

Nota: o template na Meta deve ter um botão URL com formato `https://...document-public-link?instance={{1}}`, onde `{{1}}` é o sufixo dinâmico. O parâmetro enviado será apenas o `instanceId`.

## Arquivos modificados
- `supabase/functions/document-public-link/index.ts` — nova Edge Function pública
- `src/lib/sendActivityWhatsApp.ts` — buscar documentos e montar URL do botão automaticamente
- `supabase/config.toml` — configurar `verify_jwt = false` para a nova função (se necessário)

