# Marcação "Tarefa interna" no cadastro de tarefas

## Como vai funcionar
- Os formulários de tarefa ganham a caixa **"Tarefa interna"**, desmarcada por padrão. Ela aparece na tela de Tarefas, tanto na nova tarefa quanto na edição, e na solicitação de tarefa pelo modelo e pelo Chat.
- Com a caixa marcada, o campo Cliente some e o sistema não pede mais para escolher um cliente.
- Com a caixa desmarcada, tudo funciona como hoje e o cliente continua obrigatório onde já era.
- Nos cartões do quadro e na Lista, as tarefas internas mostram o selo **"Interna"** no lugar do nome do cliente.
- Para tarefas internas, a opção "Enviar para o cliente" e os avisos ao cliente por WhatsApp e e-mail ficam desligados, porque não há cliente para receber.

## Detalhes técnicos
- Migração: `ALTER TABLE public.tasks ADD COLUMN is_internal boolean NOT NULL DEFAULT false;`. As tarefas que já existem ficam como não internas.
- `src/pages/Tasks.tsx`:
  - `is_internal` entra no tipo `Task`, no `form` e no `requestForm`.
  - O Checkbox fica acima do campo Cliente. Ao marcar, `client_id` é limpo e o campo some.
  - A validação "Selecione o cliente" (linha ~490) só vale quando a tarefa não é interna.
  - Ao salvar, grava `is_internal`, com `client_id = null` quando a tarefa é interna.
  - Selo "Interna" no cartão e na Lista. Itens de envio ao cliente e notificações ocultos.
- `src/components/chat/TaskRequestForm.tsx`: mesma caixa, mesma validação condicional e o mesmo campo gravado.
