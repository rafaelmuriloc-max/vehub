

# Certificado Digital no Cadastro do Escritório

## O que será feito

Adicionar ao formulário de "Dados da Empresa" (CompanyTab) campos para:
1. **Upload do certificado digital A1** (.pfx/.p12) -- armazenado no bucket `certificates`
2. **Senha do certificado** -- armazenada na tabela `company_settings`
3. Exibição do status do certificado (nome do arquivo, validade, botões de download/remover)

## Alterações

### 1. Migração SQL
Adicionar colunas à tabela `company_settings`:
- `digital_certificate_url` (text, nullable)
- `digital_certificate_password` (text, nullable)
- `digital_certificate_expiry` (date, nullable)

### 2. `src/components/settings/CompanyTab.tsx`
- Adicionar estado para controle do upload de certificado
- Adicionar seção de certificado digital após os campos existentes:
  - Input type="file" accept=".pfx,.p12" (admin only)
  - Input para senha do certificado
  - Exibição do arquivo atual com nome, validade e badge de status
  - Botões de download e remover (admin only)
- Upload do arquivo para `certificates/company/{id}/{filename}` no Storage
- Parsing do certificado com `node-forge` para extrair validade
- Salvar URL, senha e validade na tabela `company_settings`

O fluxo reutiliza o mesmo padrão já usado em `Clients.tsx` para certificados de clientes.

