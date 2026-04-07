

# Corrigir sobreposição do cabeçalho da página com o cabeçalho da conversa

## Problema
No mobile, o header fixo do `AppLayout` (com SidebarTrigger + título da página, `h-12`, `sticky top-0 z-10`) fica visível sobre o cabeçalho da conversa aberta. Isso causa sobreposição e esconde parte do header do chat (avatar, nome do contato, botões).

## Solução

### `src/components/AppLayout.tsx`
Ocultar o header mobile quando a rota for `/chat`. O chat já possui seu próprio header com botão de voltar, avatar e ações — o header genérico do layout é redundante nesta tela.

Alterar a linha 39 para adicionar uma condição:
```tsx
{location.pathname !== '/chat' && (
  <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background px-4 md:hidden">
    <SidebarTrigger />
    <span className="text-sm font-medium text-foreground">{pageTitle}</span>
  </header>
)}
```

## Arquivo alterado
- `src/components/AppLayout.tsx` — 1 condição adicionada

