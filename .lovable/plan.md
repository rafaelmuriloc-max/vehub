## Permitir múltiplos departamentos ao cadastrar contato pela conversa

Hoje, no diálogo "Cadastrar contato" (acessado pela conversa do chat), só é possível selecionar **um único departamento**. A proposta é permitir selecionar **vários departamentos**, criando um registro de contato em `client_department_contacts` para cada departamento escolhido.

### Mudanças (apenas em `src/components/chat/RegisterContactDialog.tsx`)

1. Trocar o estado `departmentId: string | null` por `departmentIds: string[]`.
2. Substituir o combobox de seleção única por um **multi-select** (Popover + Command) com checkboxes:
   - Cada item do dropdown alterna a presença do departamento na lista.
   - O botão exibe os nomes dos departamentos selecionados (ou "Nenhum" / "Selecione...").
   - Manter a opção de não selecionar nenhum (comportamento atual sem departamento).
3. Ajustar a função `save()`:
   - Se `departmentIds.length === 0` → manter o comportamento atual (atualiza `clients.contact_*` se vazio).
   - Se `departmentIds.length > 0` → para **cada** departamento, verificar duplicidade pelo telefone normalizado e inserir em `client_department_contacts` (loop sequencial ou `Promise.all`).
4. Manter o vínculo da conversa com o cliente (`chat_conversations.client_id` + `name_locked`) inalterado.
5. Atualizar o texto da `DialogDescription` para "Vincule este contato a uma empresa e, opcionalmente, a um ou mais departamentos."

### O que NÃO muda

- Schema do banco (`client_department_contacts` já permite múltiplas linhas por cliente/departamento).
- RLS, edge functions, outros componentes do chat.
- Lógica de reabertura/transferência de chamado.
