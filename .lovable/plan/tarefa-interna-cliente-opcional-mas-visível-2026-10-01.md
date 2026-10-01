# Tarefa interna: cliente opcional, mas visível

## O que muda
- Ao marcar **"Tarefa interna"**, o campo Cliente continua visível e não é mais limpo.
- Para tarefa interna, escolher o cliente é opcional: o rótulo vira "Cliente (opcional)" e o sistema não pede para escolher um. Nas tarefas normais, o cliente continua obrigatório.
- Vale na nova tarefa, na edição e na solicitação pelo Chat.
- Nos cartões e na Lista, aparece o selo "Interna" e, ao lado, o nome do cliente quando houver um.
- "Enviar para o cliente" e os avisos ao cliente continuam desligados nas tarefas internas.

## Detalhes técnicos
- `src/pages/Tasks.tsx`:
  - Formulário de edição: o Select de cliente aparece sempre. Ao marcar a caixa, ela não zera `client_id`.
  - O payload grava `client_id: form.client_id || null`, mesmo quando a tarefa é interna.
  - Cartão e Lista mostram o selo "Interna" e o nome do cliente juntos.
- `src/components/chat/TaskRequestForm.tsx`:
  - O Select aparece sempre, com rótulo condicional ("Cliente *" ou "Cliente (opcional)").
  - Ao marcar a caixa, ela não limpa o cliente.
  - Insert com `client_id: requestForm.client_id || null`. A validação condicional que já existe continua igual.
- Sem mudança no banco.
