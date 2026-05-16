Adicionar classes Tailwind ao `SidebarMenuButton` dos itens do menu (e do botão "Cadastro") em `src/components/AppSidebar.tsx` para deixar o ícone laranja no hover e quando o item estiver ativo.

Classe a aplicar:
```
[&>svg]:transition-colors hover:[&>svg]:text-sidebar-primary data-[active=true]:[&>svg]:text-sidebar-primary
```

`--sidebar-primary` já é o laranja Velocitä (#E8710A). O texto permanece como está; apenas o `<svg>` muda de cor.

Sem mudanças em outras páginas, rotas ou no submenu de Cadastro (que não usa ícones).