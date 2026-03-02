

## Plano: Upload de Certificado Digital A1

### Contexto
O formulário de clientes já tem campos para tipo e vencimento do certificado digital na aba Societário. Precisamos adicionar um campo para upload do arquivo `.pfx`/`.p12` do certificado A1.

### Implementação

#### 1. Criar bucket de storage no Supabase
- Criar bucket `certificates` (privado) via migration
- Criar políticas RLS: admins podem upload/delete, autenticados podem visualizar

#### 2. Adicionar coluna `digital_certificate_url` na tabela `clients`
- Migration: `ALTER TABLE clients ADD COLUMN digital_certificate_url text;`

#### 3. Alterar `src/pages/Clients.tsx`
- Adicionar campo de upload de arquivo (input type="file", accept=".pfx,.p12") ao lado dos campos de certificado digital na aba Societário
- Ao selecionar arquivo, fazer upload para `storage.certificates/{client_id}/{filename}`
- Salvar a URL no campo `digital_certificate_url`
- Exibir link para download quando já houver arquivo salvo, com botão para remover
- Incluir `digital_certificate_url` no form state, openEdit e handleSave

#### 4. UX
- Indicador de loading durante upload
- Toast de sucesso/erro
- Exibir nome do arquivo atual com opção de baixar ou substituir

### Detalhes Técnicos
- Bucket privado com URLs assinadas para download seguro
- Aceitar apenas `.pfx` e `.p12` (formatos padrão de certificado A1)
- Upload via `supabase.storage.from('certificates').upload()`
- Download via `supabase.storage.from('certificates').createSignedUrl()`

