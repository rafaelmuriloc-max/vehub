

# Corrigir obrigações de Folha para clientes Pró-labore

## Contexto
Existem 21 clientes com `payroll_type = 'pro_labore'` que estão vinculados à obrigação "Folha de Pagamento Mensal" quando deveriam estar vinculados à "Folha Pró Labore". Há 210 instâncias de obrigação geradas incorretamente.

## IDs relevantes
- **Folha de Pagamento Mensal**: `6258db4a-dc3c-49d4-913d-0f26d53ece9e`
- **Folha Pró Labore**: `8232b5f4-b984-4d39-abef-730debde6321`
- **Departamento (Pessoal)**: `af36437e-da3d-4c6e-bd71-e6584fa96843`

## Operações (via SQL insert tool — são operações de dados, não schema)

### 1. Remover vínculo "Folha de Pagamento Mensal" dos 21 clientes pró-labore
```sql
DELETE FROM client_department_obligations 
WHERE obligation_id = '6258db4a-...' 
AND client_id IN (SELECT id FROM clients WHERE payroll_type = 'pro_labore')
```

### 2. Inserir vínculo "Folha Pró Labore" para os 21 clientes
```sql
INSERT INTO client_department_obligations (client_id, department_id, obligation_id)
SELECT id, 'af36437e-...', '8232b5f4-...' FROM clients WHERE payroll_type = 'pro_labore'
```

### 3. Remover instâncias antigas de "Folha de Pagamento Mensal" desses clientes
```sql
DELETE FROM obligation_instances 
WHERE obligation_id = '6258db4a-...' 
AND client_id IN (SELECT id FROM clients WHERE payroll_type = 'pro_labore')
```

### 4. Gerar novas instâncias de "Folha Pró Labore"
Inserir instâncias para os meses restantes do ano (jan-dez 2025 ou 2026 conforme lógica existente) para cada um dos 21 clientes vinculados à nova obrigação.

## Arquivos
- Nenhuma alteração de código — apenas operações de dados no banco via SQL

