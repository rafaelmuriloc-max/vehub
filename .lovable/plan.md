## Objetivo

No mobile, o card de tarefa pendente exibido no painel sobre a conversa deve mostrar apenas informações resumidas: título da tarefa e nome da empresa. Os demais elementos (número, prioridade, departamento, "solicitado em / por", atribuído, prazo, botões de mover status, anexos, upload "Para o cliente", excluir) ficam ocultos no mobile, mas continuam visíveis no desktop. O card permanece clicável para abrir o `TaskEditDialog` com os detalhes completos.

## Mudanças

Arquivo único: `src/components/chat/PendingTasksPanel.tsx`.

- Dentro do `.map((task) => ...)`, envolver os blocos de detalhe que devem sumir no mobile com `{!isMobile && (...)}`:
  - linha do número + badge de prioridade
  - linha "Solicitado em ... por ..."
  - bloco "Atribuído"
  - linha "Prazo"
  - linha de botões `→ Aguardando / → Concluído`
  - rodapé com contadores de anexos + "Para o cliente" + lixeira
- Manter sempre visíveis: o título da tarefa (`task.title`) e o nome da empresa (`task.clients?.company_name`). No mobile, simplificar a linha de empresa para mostrar somente `company_name` (sem o `· departamento`).
- Sem mudanças de comportamento, schema, RPC ou edge functions.
