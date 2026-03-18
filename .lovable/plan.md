

# Correção do Contratante na Integração SERPRO

## Problema

A Edge Function `integra-contador` usa o CNPJ de `company_settings` como `contratante` (linha 92). Porém, o SERPRO exige que o campo `contratante` seja o CNPJ **cadastrado no e-commerce SERPRO** — que é o CNPJ da Velocitä Contabilidade (o escritório contábil que comprou as credenciais).

O CNPJ `40908083000136` em `company_settings` não corresponde ao CNPJ habilitado no SERPRO.

## Solução

### 1. Adicionar campo `serpro_cnpj` em `company_settings`

Criar migration adicionando coluna `serpro_cnpj` à tabela `company_settings` para armazenar especificamente o CNPJ habilitado no e-commerce SERPRO, separado do CNPJ geral da empresa.

### 2. Atualizar Edge Function `integra-contador`

Na linha 92, alterar a lógica de `contratanteCnpj` para priorizar `company.serpro_cnpj`:

```
const contratanteCnpj = company?.serpro_cnpj?.replace(/\D/g, "") 
  || company?.cnpj?.replace(/\D/g, "") 
  || client.document.replace(/\D/g, "");
```

### 3. Adicionar campo na UI de Configurações (`CompanyTab`)

Incluir o campo "CNPJ Contratante SERPRO" na aba de configurações da empresa para que o usuário preencha com o CNPJ correto cadastrado no e-commerce SERPRO.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/migrations/` | Nova migration: `ALTER TABLE company_settings ADD COLUMN serpro_cnpj TEXT` |
| `supabase/functions/integra-contador/index.ts` | Usar `serpro_cnpj` como contratante |
| `src/components/settings/CompanyTab.tsx` | Adicionar campo CNPJ SERPRO |

## Alternativa rápida

Se o CNPJ do SERPRO já é o CNPJ correto da Velocitä e só está errado no `company_settings`, basta corrigir o valor no banco. Mas ter um campo separado é mais robusto pois o CNPJ da empresa e o CNPJ do contrato SERPRO podem ser diferentes.

