

## Plano: Adicionar campo "Código SCI" ao cliente

### Migration
Adicionar coluna `sci_code` (text, nullable) à tabela `clients`.

### Alterações em `src/pages/Clients.tsx`
1. **Client type**: adicionar `sci_code: string | null`
2. **emptyForm**: adicionar `sci_code: ''`
3. **openEdit / handleSave**: incluir `sci_code`
4. **Aba Geral — Dados Básicos**: adicionar campo "Código SCI" na mesma linha de "Razão Social" (antes do CNPJ), com input text

### Posição no formulário
O campo ficará no topo da aba Geral, logo após "Razão Social", para fácil identificação.

