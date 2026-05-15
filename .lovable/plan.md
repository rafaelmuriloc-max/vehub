## Problema

Ao reabrir um chamado fechado (ex.: Armazém Baudoro), o cronômetro continua somando o tempo da abertura anterior em vez de zerar.

**Causa:** `reopenTicket` em `src/pages/Chat.tsx` atualiza apenas `status`, `closed_at` e `assigned_to`. Os campos `waiting_since` e `total_wait_seconds` permanecem com os valores anteriores ao fechamento, então o `WaitingBadge` (alimentado por `waiting_since`) exibe o tempo acumulado de antes.

## Solução

Zerar o cronômetro nas transições de estado do chamado, em uma única alteração no frontend (sem migration — colunas já existem):

1. **`reopenTicket`** (`src/pages/Chat.tsx` ~linha 577): no `update`, incluir
   - `waiting_since: new Date().toISOString()` (cronômetro reinicia agora)
   - `total_wait_seconds: 0`

2. **`closeTicket`** (~linha 545): no `update`, incluir
   - `waiting_since: null`
   - `total_wait_seconds: 0`
   
   Garante estado limpo ao fechar e evita carry-over caso o chamado seja reaberto futuramente por outra rota.

## Resultado

- Fechar chamado → cronômetro zerado e ocultado.
- Reabrir chamado → cronômetro recomeça do zero a partir do momento da reabertura.
- Comportamento de "espera" durante o atendimento normal (não atribuído + mensagem do cliente) continua funcionando via trigger `trg_chat_msg_start_waiting`.

## Detalhes técnicos

- Sem migration. Apenas edição em `src/pages/Chat.tsx`.
- A política de RLS atual (participante na conversa) já cobre o update adicional dos dois campos.
