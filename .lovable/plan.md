

# Atualizar clientes da planilha FOLHA.xlsx

## Resumo
Executar um script que lê a planilha, encontra os clientes pelo Código SCI, atualiza o tipo de folha, vincula a obrigação "Folha de Pagamento Mensal" do departamento Pessoal, e gera as instâncias de obrigação para os meses restantes do ano.

## Dados da planilha
- **48 clientes com tipo "Normal"** (Nornal na planilha) → `payroll_type = 'normal'`
- **21 clientes com tipo "PRO LABORE"** → `payroll_type = 'pro_labore'`
- **3 clientes com tipo "FUNCIONÁRIOS"** → `payroll_type = 'normal'` (funcionários = folha normal)

## Passos

### 1. Atualizar `payroll_type` via SQL
Para cada SCI code da planilha, executar UPDATE no campo `payroll_type` da tabela `clients` usando o `sci_code` como chave.

### 2. Vincular obrigação "Folha de Pagamento" no departamento Pessoal
- Buscar o `department_id` do departamento que contém "pessoal" no nome
- Buscar o `obligation_id` da obrigação que contém "folha" no nome nesse departamento
- Para cada cliente da planilha, inserir em `client_department_obligations` (se não existir)

### 3. Gerar instâncias de obrigação
- Para os meses restantes de 2026 (março a dezembro), criar registros em `obligation_instances` para cada cliente que ainda não tenha instância gerada

### Execução
Tudo será feito via script Python usando `psql` para as queries, sem alteração de código ou migração.

## Detalhes técnicos
- Nenhum arquivo do projeto será modificado
- Apenas operações de UPDATE e INSERT no banco via psql
- Usa `sci_code` como chave de busca (campo texto na tabela `clients`)

