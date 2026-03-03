

## Plano: Adicionar coluna "Código SCI" na listagem de clientes

### Alterações em `src/pages/Clients.tsx`

1. **Linha 461**: Adicionar `<TableHead>Código SCI</TableHead>` antes de `<TableHead>Empresa</TableHead>`
2. **Linha 472**: Adicionar `<TableCell>{c.sci_code || '-'}</TableCell>` antes da célula de `company_name`
3. **Linha 482**: Atualizar `colSpan` de 6 para 7 na mensagem "Nenhum cliente encontrado"

