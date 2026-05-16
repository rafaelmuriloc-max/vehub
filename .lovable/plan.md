# Mover "Notas Fiscais" para dentro de "Fiscal"

## Mudanças

### `src/pages/Fiscal.tsx`
- Adicionar estado `view: 'situacao' | 'notas'` (default `situacao`).
- Adicionar dois botões no canto superior direito (`Situação Fiscal`, `Notas Fiscais`), estilo idêntico ao do CalendarView (variant `default` quando ativo, `outline` quando inativo; ícone + label oculto em mobile).
- Renderizar `<SituacaoFiscalTab />` ou `<Invoices />` conforme `view`.
- Importar o componente `Invoices` de `./Invoices`.

### `src/App.tsx`
- Remover a rota `/invoices` (mantida `/invoices/emit` para emissão de NFS-e, que continua acessível por link/botão dentro da view de Notas).
- Remover o import de `Invoices` se não for usado em outro lugar.

### `src/components/AppSidebar.tsx`
- Remover o item "Notas Fiscais" do `menuItems`.

### `src/components/AppLayout.tsx`
- Remover `/invoices` de `pageTitles`.

## Observações
- A página `InvoiceEmit` (`/invoices/emit`) permanece — botões internos de Notas Fiscais que navegam para ela continuam funcionando.
- Nenhuma mudança de schema, RLS ou edge functions.
