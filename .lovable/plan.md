

# Corrigir payload de templates WhatsApp — parâmetros nomeados e botões URL

## Problema
O erro `(#100) Invalid parameter — Parameter name is missing or empty` ocorre porque os templates Meta foram criados com **parâmetros nomeados** (`{{tratamento_contato}}`, `{{nome_contabilidade}}`), mas o codigo envia os parâmetros sem o campo `parameter_name`. A API da Meta exige esse campo para templates no formato named.

Além disso, os templates possuem **botões com URL dinâmica** que também precisam de componentes `button` no payload.

## O que está errado hoje

O payload enviado:
```text
parameters: [
  { type: "text", text: "Rafael" },
  { type: "text", text: "Velocitã..." }
]
```

O que a Meta espera para parâmetros nomeados:
```text
parameters: [
  { type: "text", parameter_name: "tratamento_contato", text: "Rafael" },
  { type: "text", parameter_name: "nome_contabilidade", text: "Velocitã..." }
]
```

E para botões URL dinâmicos:
```text
{ type: "button", sub_type: "url", index: "0",
  parameters: [{ type: "text", text: "https://..." }] }
```

## Alterações

### 1. `src/lib/sendActivityWhatsApp.ts`
- Ao extrair `{{variavel}}` do `whatsapp_message_body`, incluir `parameter_name` em cada parâmetro:
  ```
  parameters: matches.map(m => ({
    type: 'text',
    parameter_name: m[1],
    text: templateVars[m[1]] || ''
  }))
  ```
- Adicionar suporte a botões URL: adicionar campo `whatsapp_button_url` na interface ou extrair de configuração. Como fallback, se o template tem botões URL, permitir configurar a URL base na atividade.

### 2. `supabase/functions/whatsapp-send/index.ts`
Nenhuma alteração — já repassa `templateParams` como `components`.

### 3. `src/pages/Obligations.tsx`
- Adicionar campo opcional `whatsapp_button_url` no formulário de atividade WhatsApp para configurar a URL dinâmica do botão (se aplicável).

### 4. Migração SQL
- Adicionar coluna `whatsapp_button_url text` na tabela `obligation_activities` para armazenar a URL dinâmica do botão do template.

### Detalhes técnicos

A construção dos `templateParams` ficará:

```text
const components = [];

// Body params com parameter_name
if (activity.whatsapp_message_body) {
  const matches = [...body.matchAll(/\{\{(\w+)\}\}/g)];
  if (matches.length > 0) {
    components.push({
      type: 'body',
      parameters: matches.map(m => ({
        type: 'text',
        parameter_name: m[1],
        text: templateVars[m[1]] || ''
      }))
    });
  }
}

// Button URL param (index 0)
if (activity.whatsapp_button_url) {
  components.push({
    type: 'button',
    sub_type: 'url',
    index: '0',
    parameters: [{ type: 'text', text: activity.whatsapp_button_url }]
  });
}

body.templateParams = components;
```

## Arquivos modificados
- `src/lib/sendActivityWhatsApp.ts` — adicionar `parameter_name` e suporte a botão URL
- `src/pages/Obligations.tsx` — campo de URL do botão no formulário
- Migração SQL — coluna `whatsapp_button_url`

