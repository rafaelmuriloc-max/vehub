# Férias como botão dentro da página Pessoal

## O que muda

O item "Férias" sai do menu lateral. No lugar, um botão "Férias" dentro da página Pessoal leva à tela de gestão de férias (rota `/ferias`, que continua existindo).

## Alterações

1. **`src/components/AppSidebar.tsx`**
   - Remover a linha `{ title: 'Férias', icon: CalendarDays, path: '/ferias' }` da lista de itens do menu.
   - Remover o import não utilizado de `CalendarDays`.

2. **`src/pages/Personnel.tsx`**
   - Adicionar um botão "Férias" (ícone `Palmtree`, variante outline) no topo da página, ao lado de "Definir pasta" e "Sincronizar".
   - Ao clicar, navega para `/ferias` (via `useNavigate`).

## O que não muda

- A rota `/ferias` e a tela de Férias continuam como estão.
- Os botões "Definir pasta" e "Sincronizar" (Pasta / Experiência / Férias) continuam iguais.

## Validação

- `bunx tsgo --noEmit` e build sem erros.
