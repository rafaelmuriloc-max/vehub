

# Upload de múltiplos arquivos simultâneos

## Resumo
Permitir selecionar vários arquivos de uma vez no input de upload. Cada arquivo será processado sequencialmente pela IA (extração de texto → classificação → importação automática ou revisão). Um indicador de progresso mostrará quantos arquivos foram processados.

## Mudanças em `src/pages/Documents.tsx`

### 1. Input com `multiple`
- Adicionar atributo `multiple` no `<input type="file">`

### 2. Processamento sequencial com progresso
- Novo state: `uploadProgress: { current: number; total: number } | null`
- `handleUpload` itera sobre todos os arquivos do `FileList`
- Para cada arquivo:
  - Atualiza progresso ("Analisando 2/5...")
  - Extrai texto, chama IA, tenta auto-import
  - Se auto-import falhar (dados incompletos): acumula numa fila de revisão
- Após processar todos: se houver arquivos pendentes de revisão, abre o dialog para o primeiro

### 3. Fila de revisão
- Novo state: `reviewQueue: ReviewData[]`
- Ao confirmar um item no dialog, processa o próximo da fila automaticamente
- Contador visual: "Revisando 1 de 3 documentos pendentes"

### 4. UI do botão
- Texto dinâmico: "Analisando 2/5..." durante processamento
- Toast final: "X documentos importados, Y pendentes de revisão"

## Arquivos modificados
- `src/pages/Documents.tsx` — lógica de upload e estados
- `src/components/DocumentReviewDialog.tsx` — exibir contador da fila (opcional, menor mudança)

