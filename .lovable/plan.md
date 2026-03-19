

# Adicionar Certificado do Contador ao Integra Contador

## Contexto

O erro 022 ocorre porque o `autorPedidoDados` (59400171000150 = CNPJ do escritório) não tem procuração no eCAC para o contribuinte. Em muitos escritórios, a procuração está vinculada ao **CPF do contador** (e-CPF), não ao e-CNPJ da empresa.

A solução é permitir configurar um segundo certificado digital (do contador) e usá-lo como alternativa para autenticação mTLS e como `autorPedidoDados`.

## Alterações

### 1. Banco de dados - Novos campos em `company_settings`

Adicionar 4 campos:
- `accountant_certificate_url` (text, nullable)
- `accountant_certificate_password` (text, nullable)
- `accountant_certificate_expiry` (date, nullable)
- `accountant_cpf` (text, nullable) - CPF do contador para usar como `autorPedidoDados`

### 2. UI - Aba Empresa (CompanyTab.tsx)

Adicionar uma seção "Certificado do Contador" abaixo do certificado do escritório existente, com:
- Campo CPF do contador
- Upload de certificado e-CPF (.pfx/.p12)
- Senha do certificado
- Indicador de validade (mesmo padrão do certificado do escritório)
- Botões download/remover (admin only)

### 3. Edge Function - integra-contador/index.ts

Modificar a lógica para:
- Carregar também `accountant_certificate_url`, `accountant_certificate_password`, `accountant_cpf` de `company_settings`
- **Se o certificado do contador estiver configurado**: usar o certificado do contador para mTLS e o CPF do contador como `autorPedidoDados`
- **Senão**: manter o comportamento atual (certificado e CNPJ do escritório)
- O campo `contratante` continua sendo o CNPJ do escritório (é quem contratou a API)

```text
Com certificado do contador:
  contratante     = CNPJ do escritório (quem contratou)
  autorPedidoDados = CPF do contador (quem tem procuração)
  mTLS            = certificado e-CPF do contador
  contribuinte    = CNPJ do cliente

Sem certificado do contador (atual):
  contratante     = CNPJ do escritório
  autorPedidoDados = CNPJ do escritório
  mTLS            = certificado e-CNPJ do escritório
  contribuinte    = CNPJ do cliente
```

### 4. Página IntegraContador.tsx

Nenhuma alteração necessária na página de consulta. A escolha do certificado é automática baseada na configuração do escritório.

## Arquivos modificados

| Arquivo | Alteração |
|---|---|
| Nova migration | Adicionar 4 campos em `company_settings` |
| `src/components/settings/CompanyTab.tsx` | Seção de certificado do contador |
| `supabase/functions/integra-contador/index.ts` | Lógica de seleção certificado/autor |

