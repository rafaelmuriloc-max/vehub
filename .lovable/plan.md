# Ajuste de layout: título e botões na mesma linha no desktop

## Objetivo
No desktop, manter o título da página "Fiscal" + subtítulo e os botões "Baixar PDFs" / "Consultar em Lote" na mesma linha horizontal, como na imagem de referência. No mobile, os elementos podem empilhar para não quebrar o layout.

## Arquivos envolvidos
- `src/pages/Fiscal.tsx`
- `src/components/integra-contador/SituacaoFiscalTab.tsx`

## Mudanças
1. Em `src/components/integra-contador/SituacaoFiscalTab.tsx`:
   - Adicionar um cabeçalho interno com:
     - Título "Fiscal" (`text-3xl font-bold`) e subtítulo "Situação fiscal dos clientes junto à Receita Federal" à esquerda.
     - Botões "Baixar PDFs" e "Consultar em Lote" à direita.
   - Usar `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4` para que no desktop fiquem lado a lado e no mobile empilhem verticalmente.
   - Reaproveitar os botões já existentes (linhas 638-674), mantendo handlers, estados de loading, contadores e condições `disabled`.

2. Em `src/pages/Fiscal.tsx`:
   - Remover o bloco de título/subtítulo atual (linhas 60-65) quando `view === 'situacao'`, pois o cabeçalho passará a ser responsabilidade do `SituacaoFiscalTab`.
   - Manter as abas de navegação inalteradas.

## Fora de escopo
- Nenhuma alteração em banco de dados, edge functions, RLS ou lógica de negócio.
- Nenhuma mudança nos handlers `handleDownloadLote` e `handleConsultarLote`, nem nos estados `zipping`, `batchRunning`, `consultingId`, `availablePdfCount`, `batchProgress`, `selected` e `clients`.

## Validação
- `npx tsc --noEmit -p tsconfig.app.json`
- Build Vite / observability logs
- Verificar visualmente no preview desktop e mobile.