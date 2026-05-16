# Mover "Integra Contador" para dentro de "Fiscal"

## Mudanças

### `src/pages/Fiscal.tsx`
- Estender o estado `view` para `'situacao' | 'notas' | 'integra'`.
- Adicionar um terceiro botão no canto superior direito: "Integra Contador" (ícone `Plug`), mesmo estilo dos demais.
- Renderizar `<IntegraContador />` quando `view === 'integra'`.
- Importar o componente `IntegraContador` de `./IntegraContador`.

### `src/App.tsx`
- Remover a rota `/integra-contador` e o import correspondente.

### `src/components/AppSidebar.tsx`
- Remover o item "Integra Contador" do `menuItems`.
- Remover `Plug` do import do `lucide-react` se não for mais usado.

### `src/components/AppLayout.tsx`
- Remover `/integra-contador` do mapa `pageTitles`.

## Observações
- Nenhuma alteração de backend, schema ou edge functions.
- Links externos diretos para `/integra-contador` deixarão de funcionar.
