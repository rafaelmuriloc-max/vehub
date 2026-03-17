

# Fix: Habilitar upload de certificado ao criar novo cliente

## Problema
O input de certificado digital tem `disabled={!editing}`, o que impede o upload quando estamos criando um novo cliente (quando `editing` é `null`). O upload precisa do `client_id` para salvar no Storage, e esse ID só existe após o `insert`.

## Solução
Mudar o fluxo para que, ao criar um novo cliente, o certificado seja armazenado temporariamente em estado local (o `File` objeto) e processado logo após o `insert` retornar o `client_id`.

### Alterações em `src/pages/Clients.tsx`:

1. **Novo estado**: `pendingCertFile` para guardar o arquivo selecionado antes de salvar
2. **Remover `disabled={!editing}`** do input de certificado — manter apenas `disabled={certificateUploading}`
3. **Alterar `handleCertificateUpload`**: Se `editing` é `null`, armazenar o arquivo em `pendingCertFile` e extrair a validade localmente (já faz isso). Não tentar upload ao Storage.
4. **Alterar `handleSave`**: Após o `insert` retornar o `clientId`, se `pendingCertFile` existir, fazer o upload do certificado e atualizar `digital_certificate_url` no registro recém-criado.
5. **Remover a mensagem** "Salve o cliente primeiro para fazer upload do certificado."

