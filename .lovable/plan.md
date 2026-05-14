## Mudança
Em `src/components/AppSidebar.tsx` (header, linhas 54–67), ocultar o bloco de texto "Velocitä / Contabilidade" quando a sidebar estiver no estado `collapsed`, deixando apenas as barras estilizadas do logo.

Aproveitar o hook `useSidebar()` (já disponível) ou a classe utilitária `group-data-[collapsible=icon]:hidden` exposta pelo `Sidebar` shadcn:

```tsx
<div className="group-data-[collapsible=icon]:hidden">
  <h2 ...>Velocitä</h2>
  <p ...>Contabilidade</p>
</div>
```

Também ajustar o padding do `SidebarHeader` para `p-3` no estado colapsado para não cortar/expandir desnecessariamente, usando a mesma variante:

```tsx
<SidebarHeader className="p-5 group-data-[collapsible=icon]:p-3">
```

Sem outras mudanças.