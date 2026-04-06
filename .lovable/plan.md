

# Corrigir formato do telefone na Edge Function cert-expiry-alert

## Problema
A Evolution API requer o número com código do país (55). O telefone cadastrado é `47988218473` (sem o `55`), causando erro 400 (`exists: false`).

## Solução
Adicionar normalização do telefone na Edge Function antes de enviar: se o número não começar com `55`, prefixar com `55`.

## Alteração
- `supabase/functions/cert-expiry-alert/index.ts` — adicionar função de normalização do telefone (~3 linhas), aplicar antes do envio via Evolution API.

```typescript
// Normalize phone: add country code if missing
let normalizedPhone = phone.replace(/\D/g, '');
if (!normalizedPhone.startsWith('55')) {
  normalizedPhone = '55' + normalizedPhone;
}
```

Usar `normalizedPhone` no body da requisição à Evolution API.

