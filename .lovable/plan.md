# Solicitar tarefa dentro do chat

Adicionar um botão "Solicitar tarefa" no cabeçalho da conversa. Ao clicar, um painel lateral abre dentro da área da conversa (sobreposto à direita, como o retângulo vermelho) contendo o mesmo formulário do dialog "Solicitar Tarefa" da página de Tarefas.

## O que será feito

1. **Extrair o formulário em componente reutilizável** — `src/components/chat/TaskRequestPanel.tsx`
   - Conterá toda a lógica hoje dentro do dialog "Solicitar Dialog" em `src/pages/Tasks.tsx` (linhas 727–834): seleção de tarefa cadastrada / nome livre, cliente, descrição, prazo, prioridade, atribuição, anexos, envio com upload de arquivos e disparo de `task-notify-client`.
   - Carrega seus próprios dados (`clients`, `profiles`, `task_templates`).
   - Props: `open`, `onClose`, `defaultClientId?`, `onCreated?`.
   - Pré-seleciona o cliente quando recebido (vamos derivar do primeiro `linked_company` da conversa).

2. **Reusar o componente em `Tasks.tsx`** — substituir o JSX do dialog atual pelo novo componente, mantendo o mesmo comportamento (apenas renderizado em modo "dialog" via prop, ou mantemos o dialog em Tasks.tsx e reutilizamos só o `<form>` interno como subcomponente). Para minimizar risco, extraímos somente o conteúdo do formulário (`TaskRequestForm`) e:
   - Em `Tasks.tsx`: dialog continua, mas seu conteúdo passa a ser `<TaskRequestForm />`.
   - Em `Chat`: o painel lateral renderiza `<TaskRequestForm />` direto.

3. **Botão no cabeçalho da conversa** — `src/components/chat/MessageArea.tsx`
   - Adicionar botão "Solicitar tarefa" (ícone `ClipboardPlus`) ao lado de "Transferir", visível quando `!isClosed`.
   - Nova prop `onRequestTask?: () => void`.

4. **Painel lateral dentro da conversa** — `src/pages/Chat.tsx`
   - Estado `taskPanelOpen`. Ao clicar no botão, abre.
   - Renderizar um painel absoluto à direita da `MessageArea`, largura fixa (`w-[420px]`), altura total, com header (título + botão fechar) e o `<TaskRequestForm />` rolável.
   - Não é dialog/modal: fica embutido no layout do chat, sobrepondo só a área da conversa (não a sidebar de conversas), conforme imagem de referência.
   - Passa `defaultClientId` derivado das companies vinculadas à conversa (já carregadas para `companyNames`).

## Detalhes técnicos

- O painel será posicionado com `absolute inset-y-0 right-0 w-[420px] border-l bg-background z-20` dentro do container relativo da `MessageArea`. Para não exigir mudanças invasivas no `MessageArea`, o painel será irmão da `MessageArea` num wrapper `relative` em `Chat.tsx`.
- No mobile, ocupará a largura total (`w-full md:w-[420px]`).
- O envio reutiliza exatamente o fluxo atual: `tasks` insert → upload em `task-attachments` → `task_attachments` insert → `task-notify-client` se houver notificação configurada via template.
- Sem mudanças de schema, sem novas Edge Functions.

## Arquivos afetados

- `src/components/chat/TaskRequestForm.tsx` (novo)
- `src/components/chat/MessageArea.tsx` (botão + prop)
- `src/pages/Chat.tsx` (estado, painel lateral, derivar defaultClientId)
- `src/pages/Tasks.tsx` (substituir conteúdo do dialog pelo componente extraído)
