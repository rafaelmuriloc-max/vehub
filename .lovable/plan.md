# Mover "Financeiro" para o menu Administração

## Mudança

### `src/components/AppSidebar.tsx`
- Remover `{ title: 'Financeiro', icon: DollarSign, path: '/' }` de `menuItems`.
- Dentro do `SidebarGroup` "Administração", adicionar um `SidebarMenuItem` para "Financeiro" (ícone `DollarSign`, path `/`) como item de menu direto — irmão do `Collapsible` "Cadastro".
- O item respeita o gating de admin: usar `{isAdmin && (...)}` para renderizar apenas para administradores (mesmo critério atual de `visibleMenuItems`).
- Manter `DollarSign` no import.

## Observações
- Rota e permissões inalteradas — apenas a posição visual no sidebar muda.
- Nada de backend.
