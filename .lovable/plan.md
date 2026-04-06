

# Tornar tabelas de notas fiscais responsivas

## Problema
As tabelas de NF-e (7 colunas) e NFS-e (9 colunas) não cabem em telas mobile — ficam cortadas ou com scroll horizontal sem controle. Os filtros na barra superior também ocupam espaço excessivo.

## Solução
Aplicar o padrão responsivo do projeto: ocultar colunas secundárias no mobile e envolver as tabelas em scroll horizontal.

## Alterações

### 1. `src/components/invoices/NfeTab.tsx`

**Tabela — ocultar colunas no mobile:**
- Coluna "Destinatário": `hidden md:table-cell`
- Coluna "Status": `hidden md:table-cell`
- Coluna "Emitente" CNPJ sub-text: `hidden md:block`

**Filtros — empilhar no mobile:**
- Selects de filtro: largura `w-full md:w-[180px]` / `w-full md:w-[220px]`
- Container de filtros: `flex-col md:flex-row`

**Scroll horizontal:**
- Envolver `<Table>` em `<div className="overflow-x-auto">`

### 2. `src/components/invoices/NfseTab.tsx`

**Tabela — ocultar colunas no mobile:**
- Coluna "Descrição": `hidden md:table-cell`
- Coluna "Impostos": `hidden md:table-cell`
- Coluna "Status": `hidden md:table-cell`
- Coluna "Tipo" badge: manter visível (é informação essencial)

**Filtros — empilhar no mobile:**
- Selects: `w-full md:w-[180px]` / `w-full md:w-[220px]`
- Container: `flex-col md:flex-row`
- Botão "Exportar XMLs": `w-full md:w-auto`

**Scroll horizontal:**
- Envolver `<Table>` em `<div className="overflow-x-auto">`

## Arquivos
- `src/components/invoices/NfeTab.tsx` — classes CSS em ~10 linhas
- `src/components/invoices/NfseTab.tsx` — classes CSS em ~12 linhas

