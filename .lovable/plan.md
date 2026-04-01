

# Importar contatos da planilha CSV para o cadastro de clientes

## O que será feito
Executar um script Python que lê o CSV de contatos, faz match de cada linha com o cliente (via CNPJ) e o departamento (via nome), e insere os registros na tabela `client_department_contacts`. O prefixo "55" será removido dos telefones.

## Mapeamento de departamentos
- "Fiscal" → `7403523f-3518-4f8e-b6c3-5f252ced0f34` (Depto Fiscal)
- "Pessoal" → `af36437e-da3d-4c6e-bd71-e6584fa96843` (Depto Pessoal)
- "Societário" → `97d0a192-63aa-425f-8f46-4f4620b12f09` (Depto Societários)
- "Financeiro" → `e9dce0d9-76b8-4115-893c-71a22871a6f0` (Depto Financeiro)

## Lógica do script
1. Ler o CSV (~809 linhas, ~200 clientes × 4 departamentos)
2. Buscar todos os clientes do banco via API (match por CNPJ/`document`)
3. Para cada linha do CSV:
   - Encontrar o `client_id` pelo CNPJ
   - Mapear o departamento para o `department_id`
   - Remover prefixo "55" do telefone
   - Usar o campo NOME como `contact_name`
4. Limpar contatos existentes (são apenas 5) e inserir os novos
5. Inserir em lotes via Supabase REST API

## Dados inseridos por registro
- `client_id`: do match por CNPJ
- `department_id`: do mapeamento acima
- `contact_name`: coluna NOME do CSV
- `contact_email`: coluna EMAIL
- `contact_phone`: coluna Telefone (sem prefixo 55)

## Arquivos
- Nenhuma alteração de código — apenas operação de dados via script

