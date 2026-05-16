# Mover "Clientes" para o menu Cadastro

## Mudança

### `src/components/AppSidebar.tsx`
- Remover o item `{ title: 'Clientes', icon: Users, path: '/clients' }` de `menuItems`.
- Adicionar `{ title: 'Clientes', path: '/clients' }` como primeiro item de `cadastroSubItems`.
- Remover `Users` do import do `lucide-react` se não for mais usado em outro lugar do arquivo.

## Observações
- A rota `/clients` permanece inalterada — apenas a localização visual no menu lateral muda.
- Nenhuma outra mudança necessária (sem alterar páginas, rotas ou permissões).
