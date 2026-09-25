# Cronômetro em lote para obrigações feitas juntas

## Como vai funcionar

1. No calendário, marque as obrigações de várias empresas (ex.: todas as "Folha de Pagamento" do mês) usando a seleção que já existe. Continua valendo o "marcar todas".
2. Na barra de ações em lote aparece o botão novo **Iniciar cronômetro (N)**.
3. Aparece uma faixa fixa no topo do calendário: "Cronômetro em lote – Folha de Pagamento · 23 empresas · 00:42:10", com o botão **Parar**.
4. Ao parar, o tempo total é **dividido igualmente** entre as empresas. Exemplo: 2h para 20 empresas dão 6 min para cada uma.
5. Cada card mostra a parte da empresa no total dela, e o relatório "Custo por Cliente" já passa a contar esse tempo sem mais mudanças.

Regras:
- Continua valendo um cronômetro por pessoa. Iniciar um lote pausa o cronômetro individual que estiver rodando, e iniciar um individual encerra o lote.
- Se a faixa do lote for fechada ou a página recarregada, o lote continua rodando e a faixa volta a aparecer.
- Não é possível iniciar um lote com obrigações já concluídas. Elas são ignoradas, com aviso.

## Detalhes técnicos

- Migração: nova coluna `time_entries.batch_id uuid null` com índice. RLS e GRANTs atuais continuam os mesmos.
- Ao iniciar: um registro por instância, todos com o mesmo `batch_id` e o mesmo `started_at`.
- Ao parar: calcula o tempo total decorrido, grava em cada registro `ended_at = now` e `duration_seconds = total / N` (arredondado; a sobra vai para o primeiro registro).
- Enquanto roda, os cards do lote mostram "em lote" em vez do tempo cheio, para o total não ser contado N vezes.
- `TimeTracker.tsx`: expor `startBatch(ids)` / `stopBatch(batchId)` e um hook `useActiveBatch()` (lote aberto do usuário, com realtime pelo canal que já é compartilhado). Iniciar um individual encerra o lote ativo.
- `CalendarView.tsx`: botão na barra de seleção múltipla (dia e mês) e faixa do lote ativo.
- `ClientCostReport.tsx` continua somando `duration_seconds`, sem alteração.
- Nenhuma função no servidor precisa mudar.
