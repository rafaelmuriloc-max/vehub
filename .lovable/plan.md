## Ordenação por coluna na lista de clientes

Adicionar setas de ordenação no cabeçalho da tabela em `src/pages/Clients.tsx`, permitindo ordenar por qualquer coluna com ciclo asc → desc → sem ordenação.

### Comportamento
- Clique no cabeçalho alterna o sentido (asc/desc) e, no terceiro clique, remove a ordenação.
- Ícone exibido: `ArrowUpDown` (neutro), `ArrowUp` (asc) e `ArrowDown` (desc) ao lado do título.
- Apenas uma coluna ordenada por vez.
- Coluna "Ações" não recebe seta.

### Colunas ordenáveis
- Código SCI — numérico natural (1, 2, 3, …, 10, 100). Implementado convertendo `sci_code` para número quando possível; valores não numéricos vão para o fim. Vazios sempre por último.
- Empresa — alfabética (localeCompare pt-BR).
- Documento — string.
- Regime — usa o label de `TAX_REGIME_LABELS`.
- Contato — string.
- Valor Mensal — numérico.
- Status — pelo label de `statusLabels`.
- Venc. Certificado — por data (timestamp); sem certificado fica por último.

### Implementação técnica
- Novo estado: `sortKey: string | null` e `sortDir: 'asc' | 'desc' | null`.
- Função `sortedClients` derivada de `filtered` antes do `paginatedClients` (linha 956). Ordenação estável; nulos/vazios empurrados para o fim independentemente do sentido.
- `paginatedClients` passa a fatiar `sortedClients`.
- Componente local `SortableHead` recebendo `column`, `label` e renderizando `<TableHead>` clicável com ícone do `lucide-react`.
- Comparador SCI: `const n = Number(v); return Number.isFinite(n) ? n : Infinity` para garantir ordem natural 1, 2, 3 (sem zero-padding).

### Fora de escopo
- Persistência da ordenação (não salva entre sessões).
- Ordenação multi-coluna.
- Mudanças no card view mobile (linha 1446) — mantém a ordem atual.