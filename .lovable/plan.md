

# Incluir Código SCI na busca de clientes

## Alteração

No arquivo `src/pages/Clients.tsx`, linha 845, adicionar `c.sci_code` à condição de busca:

```typescript
// De:
const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) || c.document?.includes(search);

// Para:
const matchSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) || c.document?.includes(search) || c.sci_code?.toLowerCase().includes(search.toLowerCase());
```

Também atualizar o placeholder do input (linha 1209) de `"Buscar por nome ou documento..."` para `"Buscar por nome, documento ou código SCI..."`.

## Arquivo
- `src/pages/Clients.tsx` — 2 linhas alteradas

