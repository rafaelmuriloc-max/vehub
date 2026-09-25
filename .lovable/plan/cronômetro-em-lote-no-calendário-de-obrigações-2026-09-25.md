# Cronômetro em lote no calendário de obrigações

Um único cronômetro para obrigações de várias empresas feitas de uma vez (ex.: folha de 23 empresas). O tempo trabalhado é dividido entre elas no final.

## Fluxo do colaborador

1. Selecionar as obrigações no calendário (dia ou mês) com a seleção que já existe.
2. Clicar em **Iniciar cronômetro em lote (N)** na barra de seleção.
3. Confirmar numa janela que mostra: nome da obrigação (ou "Obrigações diferentes"), competência, quantidade de empresas e de obrigações, a lista do lote e as que ficaram de fora, com o motivo (concluída, suspensa ou em "Aguardando").
4. Um painel fixo e discreto aparece no calendário com: nome do lote, empresas/obrigações, tempo trabalhado, tempo por empresa, responsável e os botões **Pausar / Retomar / Finalizar**.
5. Ao finalizar, escolher uma opção:
   - só registrar o tempo;
   - registrar e concluir todas as obrigações que podem ser concluídas;
   - registrar e escolher quais concluir.

## Regras

- **Pausas:** não contam como tempo trabalhado e ficam guardadas para conferência. Exemplo: 08h–09h, pausa até 09h30, trabalho até 10h30 = 2h.
- **Rateio igual por padrão**, ao segundo: a soma das partes é exatamente o total trabalhado, e a sobra de segundos vai para as primeiras obrigações.
- **Rateio manual (opcional)**, depois de finalizar, para admin ou para o dono do lote. A soma tem que continuar igual ao total, senão não salva. Fica guardado quem mudou, quando, e o rateio anterior e o novo.
- **Um cronômetro por pessoa:** ao iniciar um cronômetro individual com um lote rodando, aparece a pergunta "Você possui um cronômetro em lote ativo. Deseja pausá-lo antes de iniciar esta atividade?". O lote nunca é encerrado nem rateado sem confirmação. Com o lote pausado, o painel oferece **Retomar**.
- Cada colaborador tem os próprios lotes, e pessoas diferentes podem ter lotes ao mesmo tempo.
- Os cards das obrigações do lote ganham um selo "Em lote". Clicar no selo mostra o lote e o tempo atribuído àquela obrigação.
- Recarregar a página ou entrar de novo recupera o lote e o tempo acumulado, porque tudo fica gravado no banco.
- **Relatórios:**
  - Custo por Cliente usa o tempo atribuído a cada obrigação. Custo total = horas reais × valor/hora, dividido pelo mesmo rateio, com os centavos ajustados para a soma bater.
  - A produtividade por colaborador conta o tempo real do lote (2h, e não 40h).
  - Os registros de tempo antigos continuam iguais.

## Detalhes técnicos

Migração:
- `time_batches`: user_id, label, status (`running`/`paused`/`finished`), started_at, finished_at, worked_seconds, split_mode (`equal`/`manual`), created_at, updated_at.
- `time_batch_pauses`: batch_id, paused_at, resumed_at.
- `time_batch_split_history`: batch_id, changed_by, changed_at, previous jsonb, new jsonb.
- `time_entries.batch_id uuid null` (FK para `time_batches`, com índice).
- Índice único parcial: um lote `running`/`paused` por usuário, para que cliques repetidos não criem lotes duplicados.
- GRANTs para authenticated e service_role. RLS: o dono vê e altera os próprios lotes, e o admin vê e altera todos.
- Funções SECURITY DEFINER que validam `auth.uid()` e rodam de forma atômica:
  - `start_time_batch(instance_ids[], label)`: pausa o cronômetro individual aberto e cria o lote com uma `time_entries` por instância, com duração 0 e `ended_at` nulo até finalizar.
  - `pause_time_batch` e `resume_time_batch`.
  - `finish_time_batch(id)`: calcula `worked_seconds` descontando as pausas, grava o rateio igual em `duration_seconds` e fecha as entradas.
  - `resplit_time_batch(id, jsonb)`: confere se a soma é igual ao total e grava o histórico.
- Durante o lote, as entradas ficam abertas, mas marcadas com `batch_id`. O `TimeTracker` ignora o cálculo "ao vivo" dessas entradas, para não contar o tempo cheio em cada card.

Frontend:
- `TimeTracker.tsx`: hook `useActiveBatch()` (realtime pelo canal compartilhado), selo "Em lote" e confirmação de pausa antes de iniciar um individual.
- Novos componentes em `src/components/time-tracking/`:
  - `BatchStartDialog`
  - `BatchPanel` (painel fixo)
  - `BatchFinishDialog` (3 opções; a conclusão reaproveita `quickCompleteSelectedInstances`)
  - `BatchSplitDialog`
- `CalendarView.tsx`: botão na barra de seleção do dia e do mês, e o painel.
- `ClientCostReport.tsx`: rateio de centavos por lote. `TasksRankingTab` (horas por colaborador): contar `worked_seconds` do lote uma única vez, em vez de somar as entradas.

## Validação
- Testes unitários do rateio: 20 obrigações em 2h dão 6 min cada e soma exata; divisão de centavos (R$ 60 em 20 partes dá R$ 3,00 cada); pausa de 30 min descontada; rateio manual com soma errada é recusado.
- Conferência no banco depois de uma rodada de teste: nenhum tempo negativo, nenhum lote duplicado.
- Não vai dar para testar a tela no navegador, porque ela pede login.
