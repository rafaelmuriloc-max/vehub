

# Importação em Lote de Clientes via Certificados A1

## O que será feito

Adicionar um botão "Importar Certificados" na página de Clientes que permite selecionar uma pasta com arquivos `.pfx`/`.p12`. Para cada certificado, o sistema:

1. Lê o arquivo com `node-forge` usando a senha informada
2. Extrai o CNPJ do campo `Subject` do certificado (CN ou serialNumber)
3. Extrai a data de vencimento do certificado
4. Consulta a BrasilAPI para preencher razão social, endereço, atividades, etc.
5. Mostra um preview dos clientes encontrados com status (novo/existente/erro)
6. Ao confirmar: cria o registro no banco, faz upload do `.pfx` para o Storage (`certificates` bucket), e salva `digital_certificate_url`, `digital_certificate_password` e `digital_certificate_expiry` no cliente

## Fluxo do usuário

1. Clica em "Importar Certificados" na página de Clientes
2. Dialog abre pedindo a senha padrão dos certificados
3. Seleciona a pasta com os arquivos (usa `<input webkitdirectory>`)
4. Sistema processa cada arquivo e exibe tabela com: nome do arquivo, CNPJ extraído, razão social (da BrasilAPI), vencimento, status (novo/já existe/erro de senha)
5. Usuário confirma importação
6. Sistema cria clientes novos, faz upload dos certificados, e atualiza os existentes (opcional)

## Detalhes técnicos

- Extração do CNPJ: certificados A1 brasileiros têm o CNPJ no `commonName` (CN) do subject, geralmente no formato `RAZAO SOCIAL:CNPJ`. Fallback para `serialNumber`.
- Deduplicação: verifica se já existe cliente com mesmo `document` (CNPJ). Se existir, marca como "já cadastrado" e permite atualizar apenas o certificado.
- Tratamento de erros por arquivo: se a senha falhar em algum arquivo, marca como erro e continua com os demais.
- Reusa a lógica existente de `fetchCnpjData` (BrasilAPI) para preencher dados.
- Reusa a lógica existente de upload para o bucket `certificates`.

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `src/pages/Clients.tsx` | Adicionar botão "Importar Certificados", dialog de importação com progresso/preview, lógica de extração em lote, criação de clientes e upload de certificados |

