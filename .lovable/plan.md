## Objetivo

Ao selecionar mensagens da conversa no formulário de solicitar tarefa:
- **Mensagens de texto** → anexar ao campo **Descrição** da tarefa (em vez de virar um arquivo .txt).
- **Mídias/arquivos** → continuar sendo anexados como arquivos em `task_attachments` (comportamento atual).

## Mudanças (apenas em `src/components/chat/TaskRequestForm.tsx`)

1. **Pré-visualização ao selecionar (no `MessagePicker.onConfirm`)**:
   - Após `setPickedItems(items)`, montar um bloco de texto com as mensagens de texto selecionadas, ordenadas cronologicamente, no formato:
     ```
     --- Mensagens da conversa ---
     [dd/mm/aaaa hh:mm] Fulano:
     conteúdo da mensagem
     
     [dd/mm/aaaa hh:mm] Beltrano:
     conteúdo da mensagem
     ```
   - Atualizar `requestForm.description`:
     - Remover qualquer bloco anterior delimitado por `--- Mensagens da conversa ---` ... fim do texto.
     - Concatenar a descrição existente (preservando o que o usuário digitou) com o novo bloco.
   - Se nenhuma mensagem de texto foi selecionada, apenas remover o bloco anterior (caso exista).

2. **No `handleSubmit`**:
   - Remover totalmente o trecho que cria o arquivo `mensagens-da-conversa-{timestamp}.txt` e o insere em `task_attachments` (linhas 184–210).
   - Manter o loop que faz download/re-upload das **mídias** selecionadas como anexos (comportamento atual).
   - A descrição enviada na criação da tarefa (`requestForm.description`) já incluirá as mensagens de texto, conforme passo 1.

3. **UX**: o usuário ainda pode editar manualmente a descrição depois da seleção; o bloco fica visível no `Textarea`.

Sem alterações em schema, RLS, edge functions ou outros arquivos.