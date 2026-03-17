

# Plano: Criar menu "Fiscal" com iframe do Monitor Contábil

## Alterações

### 1. Nova página `src/pages/Fiscal.tsx`
Página simples que renderiza um iframe fullscreen apontando para `https://app.monitorcontabil.com.br/`. O iframe ocupará toda a área de conteúdo disponível.

```typescript
export default function Fiscal() {
  return (
    <div className="w-full h-[calc(100vh-7rem)]">
      <iframe
        src="https://app.monitorcontabil.com.br/"
        className="w-full h-full border-0 rounded-lg"
        allow="clipboard-write"
        title="Monitor Contábil"
      />
    </div>
  );
}
```

### 2. Rota em `src/App.tsx`
Adicionar `<Route path="/fiscal" element={<Fiscal />} />` dentro do `AppLayout`.

### 3. Menu em `src/components/AppSidebar.tsx`
Adicionar item "Fiscal" ao array `menuItems` com ícone `Scale` (lucide-react), path `/fiscal`, posicionado após "Notas Fiscais".

**Nota**: O site externo pode bloquear iframes via header `X-Frame-Options` ou `Content-Security-Policy`. Se isso acontecer, o iframe mostrará uma página em branco e será necessário uma abordagem alternativa (ex: abrir em nova aba).

