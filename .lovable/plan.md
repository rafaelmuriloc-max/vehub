## Plano: Botões "Baixar Todos XML" e "Baixar Todos PDF" — NF-e

Adicionar dois botões no header da seção "NF-e Recebidas" (`src/components/invoices/NfeTab.tsx`) que respeitam os filtros ativos (cliente + período) e baixam todas as NF-e em um único arquivo `.zip`.

### UI
- Novos botões ao lado dos filtros, acima da tabela:
  - "Baixar XMLs" (ícone `FileCode`)
  - "Baixar PDFs" (ícone `FileText`)
- Desabilitados se `filteredInvoices.length === 0` ou enquanto rodando.
- Mostram contador de progresso no label: `Baixando 5/20...`.
- Toast final com sucessos/erros.

### Lógica
- Reutiliza `filteredInvoices` (já reflete filtros).
- Para cada NF-e, chama `nfe-download` (XML) — mesmo fluxo do `handleDownloadXml`, mas:
  - Sem auto-manifestação em lote (puladas com erro silencioso para não travar).
  - Para PDF: gera DANFE via `DANFe({ xml })` igual `handleDownloadPdf`.
- Junta tudo num `JSZip`, gera blob, faz download como `nfe-xmls-YYYYMMDD.zip` / `nfe-pdfs-YYYYMMDD.zip`.
- Concorrência limitada (5 paralelos) para não estourar.
- `jszip` já está instalado.

### Tratamento de erros
- NF-e sem XML disponível (precisa manifestação) → contabilizada como falha, segue com as demais.
- Toast final: `15 baixados, 3 sem XML disponível`.