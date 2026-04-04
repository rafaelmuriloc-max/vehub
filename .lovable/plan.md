

# Adicionar botão de menu (SidebarTrigger) no mobile

## Problema
O `SidebarTrigger` está importado mas **nunca é renderizado** no `AppLayout`. No desktop a sidebar fica visível por padrão, mas no mobile ela fica oculta (offcanvas) e sem nenhum botão para abri-la, tornando a navegação impossível.

## Solução
Adicionar um header fixo no topo da área de conteúdo que exibe o `SidebarTrigger` (ícone hambúrguer). Esse header ficará visível em todas as telas, mas é especialmente crítico no mobile.

## Alteração

### `src/components/AppLayout.tsx`
Adicionar um `<header>` entre o `<AppSidebar />` e o `<main>`, dentro do flex container:

```tsx
<main className="flex-1 overflow-auto">
  <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-4 md:hidden">
    <SidebarTrigger />
    <span className="text-sm font-medium">{pageTitle}</span>
  </header>
  <div className="p-6">
    <Outlet />
  </div>
</main>
```

- `md:hidden` — o header com trigger só aparece em telas < 768px (mobile/tablet)
- `sticky top-0 z-10` — fica fixo no topo ao rolar
- Exibe o título da página atual ao lado do ícone

Nenhuma lógica alterada — apenas um elemento visual adicionado.

## Arquivo
- `src/components/AppLayout.tsx` (~4 linhas adicionadas)

