

# Corrigir Certificado de Autenticação do Integra Contador

## Problema
A edge function usa o certificado digital do **cliente** para autenticação mTLS, mas deveria usar o certificado do **escritório** (contratante). O SERPRO valida que o certificado corresponde ao NI do contratante e rejeita com 403.

## Solução
Alterar `supabase/functions/integra-contador/index.ts` para usar o certificado do escritório (`company_settings`) em vez do certificado do cliente.

## Alterações

### Arquivo: `supabase/functions/integra-contador/index.ts`

1. **Carregar certificado do escritório** em vez do cliente:
   - Buscar `digital_certificate_url` e `digital_certificate_password` de `company_settings` (já carregado na linha 86-90, mas só pega `cnpj` e `serpro_cnpj`)
   - Expandir o select para incluir `digital_certificate_url, digital_certificate_password`
   - Validar que o escritório tem certificado configurado

2. **Usar certificado do escritório para mTLS**:
   - Baixar o PFX de `company_settings.digital_certificate_url` (caminho no bucket `certificates`)
   - Parsear com `company_settings.digital_certificate_password`

3. **Manter o certificado do cliente apenas como referência** (não usado para auth):
   - O client continua fornecendo o CNPJ do contribuinte para o campo `dados`
   - Remover a exigência de certificado digital no cliente para usar o Integra Contador

### Detalhes técnicos

```
Antes:
  company_settings → contratanteCnpj (CNPJ apenas)
  client → certificado PFX para mTLS ❌

Depois:
  company_settings → contratanteCnpj + certificado PFX para mTLS ✅
  client → CNPJ do contribuinte (dados da consulta)
```

- Linha 86-90: adicionar `digital_certificate_url, digital_certificate_password` ao select de `company_settings`
- Linhas 81-83: remover validação de certificado do cliente
- Linhas 94-110: trocar download do certificado do cliente pelo do escritório
- Adicionar validação de que o escritório tem certificado configurado

