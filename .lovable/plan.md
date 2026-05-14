## Mudança

### 1. Renomear botão no `ChatInput.tsx`
- "Anexar de obrigação" → "Anexar do sistema"
- Ao clicar, abrir um novo dialog seletor (em vez de chamar direto `onPickFromObligation`).

### 2. Novo dialog seletor `AttachFromSystemDialog.tsx`
Janela simples com 2 botões grandes:
1. **Anexar de obrigação** → fecha e dispara `onPickObligation()` (abre o `AttachFromObligationDialog` existente, sem alterações).
2. **Anexar documentos da empresa** → fecha e dispara `onPickSociety()` (abre o novo dialog societário).

### 3. Novo dialog `AttachSocietyDocumentsDialog.tsx`
Estrutura semelhante ao `AttachFromObligationDialog`, porém:
- Combobox para selecionar a empresa (mesma lógica de descoberta via `conversationClientId` + `client_department_contacts` por telefone).
- Lista os registros de `client_society_documents` da empresa (`document_label`, `file_name`, `file_url`).
- Multi-seleção com "Selecionar todos".
- Envio: gera signed URL no bucket `documents` para cada `file_url`, chama `onSend(url, file_name, detectType(file_name))`.

### 4. Wiring em `src/pages/Chat.tsx`
- Adicionar estado `attachSystemOpen` e `attachSocietyOpen`.
- Substituir `onPickFromObligation={() => setAttachObligationOpen(true)}` por `onPickFromObligation={() => setAttachSystemOpen(true)}` (mantém a prop existente para minimizar mudanças no `ChatInput`).
- Renderizar `<AttachFromSystemDialog>` que dispara `setAttachObligationOpen(true)` ou `setAttachSocietyOpen(true)`.
- Renderizar o novo `<AttachSocietyDocumentsDialog>` reutilizando o mesmo callback `onSend` já passado ao dialog de obrigações.

Sem alterações de banco — `client_society_documents` já existe e tem RLS de SELECT para autenticados.