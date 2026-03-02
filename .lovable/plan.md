

## Plano: Senha do certificado + extração automática do vencimento

### O que muda

1. **Campo de senha do certificado** — novo campo `digital_certificate_password` (text) na tabela `clients` + input de senha na aba Societário.

2. **Extração automática do vencimento** — ao fazer upload do `.pfx/.p12`, usar a biblioteca `node-forge` (JS puro, roda no browser) para abrir o arquivo com a senha informada e extrair a data de validade do certificado X.509 contido nele. O campo de vencimento será preenchido automaticamente.

### Implementação

#### 1. Migration
- `ALTER TABLE clients ADD COLUMN digital_certificate_password text;`

#### 2. Instalar dependência
- `node-forge` — biblioteca JS para parsing de PKCS#12 (PFX) no browser, sem necessidade de backend.

#### 3. Alterar `src/pages/Clients.tsx`
- Adicionar campo `digital_certificate_password` ao form state, openEdit e handleSave
- Adicionar input type="password" na aba Societário (antes do upload)
- No `handleCertificateUpload`: antes de enviar ao storage, ler o arquivo como ArrayBuffer, usar `forge.pkcs12.pkcs12FromAsn1()` com a senha para extrair o certificado e pegar `cert.validity.notAfter`, preenchendo automaticamente `digital_certificate_expiry`
- Se a senha estiver errada ou vazia, mostrar toast de erro pedindo a senha correta
- O campo de vencimento passa a ser read-only (preenchido automaticamente)

#### 4. Fluxo do usuário
1. Preenche a senha do certificado
2. Seleciona o arquivo .pfx/.p12
3. Sistema valida a senha, extrai o vencimento e faz o upload
4. Se senha incorreta: toast de erro, upload cancelado

### Detalhes Técnicos
- `node-forge` parseia PKCS#12 no browser sem backend
- `forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(binary), password)` retorna bags com certificados
- `certBag.cert.validity.notAfter` → Date do vencimento
- Senha armazenada em texto na coluna (considerar criptografia futura se necessário)

