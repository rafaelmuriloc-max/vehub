

## Plano: Remover campo "Quantidade de Funcionários" da aba Pessoal

Remover a linha 641 do `src/pages/Clients.tsx` que contém o campo "Quantidade de Funcionários". Os campos `employee_count` no tipo Client, emptyForm e handleSave podem ser mantidos no banco para compatibilidade, apenas o campo visual será removido.

### Alteração
- **`src/pages/Clients.tsx` linha 641**: Remover o `<div>` com o input "Quantidade de Funcionários"

