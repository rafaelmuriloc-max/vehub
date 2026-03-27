

# Importação de Certificados — Apenas para Clientes Existentes

## Objetivo
Ajustar o fluxo de importação de certificados para que apenas clientes já cadastrados recebam o certificado (ignorando CNPJs não cadastrados), adicionar coluna de vencimento do certificado na lista de clientes, e ignorar silenciosamente certificados com senha incorreta.

## Mudanças

### 1. Modificar `src/components/CertificateImportDialog.tsx`
- **Senha incorreta**: Em vez de marcar como erro e exibir na lista, simplesmente pular o arquivo (`continue` sem adicionar ao array `results`)
- **CNPJ não cadastrado**: Marcar como "ignorado" ou simplesmente não incluir na lista de preview — atualmente o status `new` cria um cliente novo; mudar para ignorar esses certificados
- **Apenas `exists`**: No `handleImport`, processar apenas entries com status `exists` (CNPJ encontrado na base)
- Remover toda a lógica de criação de novo cliente (bloco `else` no handleImport que faz `INSERT`)

### 2. Adicionar coluna "Venc. Certificado" na tabela de clientes (`src/pages/Clients.tsx`)
- Na tabela desktop: adicionar `<TableHead>Venc. Certificado</TableHead>` após "Status"
- Exibir `digital_certificate_expiry` formatada em dd/MM/yyyy
- Badge colorido: verde se > 30 dias, amarelo se < 30 dias, vermelho se vencido, cinza se sem certificado
- Nos cards mobile: adicionar a mesma informação

### Detalhes técnicos
- O campo `digital_certificate_expiry` já existe na tabela `clients` — não precisa de migração
- A busca de clientes existentes já carrega esse campo
- O `colSpan` da linha vazia precisa ser atualizado de 7 para 8

