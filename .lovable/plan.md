## Responsividade: corrigir overflow do diálogo de anexar e padronizar diálogos/telas

### Problema imediato (visível no screenshot)
No diálogo "Anexar arquivo de obrigação", a lista de arquivos vaza para fora da caixa: nomes longos não truncam e o container `border rounded-md` se estende além do `DialogContent`. Causa: falta `overflow-hidden`/`min-w-0` no container da lista; o `truncate` interno não tem efeito porque o pai cresce com o conteúdo.

### Mudanças

1. **`src/components/chat/AttachFromObligationDialog.tsx`**
   - Container de arquivos: adicionar `overflow-hidden` no wrapper `border rounded-md`.
   - Garantir `min-w-0` em toda a coluna `space-y-3` e nos `<label>` de cada arquivo.
   - Span do nome: manter `truncate flex-1 min-w-0` e `block` para forçar truncamento.
   - DialogContent: usar `w-[calc(100vw-2rem)] sm:max-w-lg` e `max-h-[90dvh] overflow-hidden flex flex-col`, com a área de conteúdo `flex-1 overflow-y-auto` para evitar estouro vertical em telas pequenas.

2. **Auditoria rápida de outros diálogos críticos** (somente correções pontuais quando houver overflow real):
   - `src/components/chat/NewConversationDialog.tsx`
   - `src/components/EmailComposeDialog.tsx`
   - `src/components/CertificateImportDialog.tsx`
   - `src/components/DocumentReviewDialog.tsx`
   
   Padrão aplicado a cada um, se ainda não estiver:
   - `DialogContent` com `w-[calc(100vw-2rem)] sm:max-w-...` e `max-h-[90dvh] overflow-hidden flex flex-col`.
   - Conteúdo principal com `flex-1 overflow-y-auto`.
   - Triggers/itens com `min-w-0` + `truncate` onde houver textos longos (nomes de empresas/arquivos).
   - Footers com `flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2`.

3. **Sem alterações em telas/páginas de listagem ou em lógica de negócio** — escopo limitado a diálogos com overflow conhecido.

### Fora do escopo desta entrega
- Reformular layouts de páginas inteiras (Clientes, Tarefas, Fiscal, etc.) — caso queira incluir, basta indicar quais.

### Detalhes técnicos
- Uso de `dvh` para evitar problemas com a barra de URL no mobile (já é convenção do projeto).
- `min-w-0` é necessário em flex items para que `truncate` funcione (caso clássico em flex containers).
