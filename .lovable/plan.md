Adicionar regras em `src/index.css` que forçam o `<svg>` dentro dos botões do menu lateral a ficar laranja (`--sidebar-primary`) nos estados `:hover` e `data-[active=true]`:

```css
[data-sidebar="menu-button"]:hover > svg,
[data-sidebar="menu-button"][data-active="true"] > svg {
  color: hsl(var(--sidebar-primary));
}
```

Remover as classes utilitárias equivalentes que adicionei em `src/components/AppSidebar.tsx` (que não estão tendo efeito por causa de merge/precedência) para deixar a regra única no CSS global.

Sem mudanças no submenu de Cadastro (sem ícones) e sem alteração em rotas/comportamento.