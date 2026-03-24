

# Popup de Atividades ao Clicar na Obrigação no Calendário

## Objetivo
Ao clicar numa linha da tabela de obrigações do dia selecionado no calendário, abrir um dialog mostrando as atividades (tarefas) daquela obrigação/instância. Atividades do tipo "document" permitem anexar/baixar arquivo. Atividades do tipo "checklist" têm checkbox para marcar conclusão.

## Mudanças

### Arquivo: `src/pages/CalendarView.tsx`

1. **Adicionar ao CalendarEvent o `instanceId`** para poder buscar a instância correta ao clicar.

2. **Carregar dados adicionais**: `obligation_activities` e `obligation_activity_completions` (mesma abordagem do ClientObligationsTab).

3. **State para dialog**: `detailInstance` (Instance selecionada) e estado para controle do dialog.

4. **Tornar linhas da tabela clicáveis**: cada `TableRow` na lista do dia selecionado abre o dialog com a instância correspondente.

5. **Dialog de atividades**: Reutilizar o mesmo padrão do ClientObligationsTab:
   - Lista as atividades da obrigação
   - Tipo `document`: ícone FileText + botão Upload/Anexar + botão Baixar (se já tem arquivo)
   - Tipo `checklist`/outros: Checkbox para marcar/desmarcar + ícone + título
   - Atividades completadas ficam com `line-through`

6. **Funções de ação**: `toggleCompletion` e `handleFileUpload` + `downloadFile` (mesma lógica do ClientObligationsTab).

### Detalhes técnicos
- Sem mudanças no banco de dados
- Imports adicionais: `Dialog, DialogContent, DialogHeader, DialogTitle`, `Checkbox`, `FileText, CheckSquare, MessageCircle, Mail, Upload, Download`, `format` do date-fns
- O `CalendarEvent` type ganha campo `instanceId: string` para vincular ao dialog
- As funções de toggle/upload/download são cópias diretas do padrão já existente

