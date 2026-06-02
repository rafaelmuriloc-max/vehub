## Diagnóstico

- O cron existe e está ativo (`scheduled-messages-runner`, a cada 15 minutos).
- O cron está chamando a função: há execuções registradas às 14:45, 15:00, 15:15 e 15:30 UTC.
- Os agendamentos foram processados e geraram histórico em `scheduled_message_runs`.
- O problema atual não é o cron não executar; é que as entregas com anexo estão falhando na Evolution API com:
  - `Evolution media 400: {"message":["[object Object]"]}`
- Também há um problema de resiliência: quando uma entrega falha no dia, o runner considera o agendamento como “já executado hoje” e não tenta reenviar automaticamente.

## Plano de correção

1. Ajustar o envio pela Evolution API em `scheduled-messages-runner`:
   - Para mensagens com anexo, enviar primeiro o texto via `sendText`.
   - Depois enviar o arquivo via `sendMedia` sem `caption`, seguindo o padrão já usado em outras funções do projeto.
   - Garantir `fileName` sempre preenchido para documentos.

2. Adicionar retry no envio de mídia:
   - Tentar reenviar o anexo até 3 vezes.
   - Usar pequena espera progressiva entre tentativas para cobrir falhas temporárias de Storage/Evolution.

3. Permitir reprocessamento de falhas do mesmo dia:
   - Se já existir `scheduled_message_runs` para o agendamento no dia, não duplicar entregas enviadas.
   - Reprocessar apenas clientes com entrega `failed`.
   - Atualizar o resumo (`sent`, `failed`, `skipped`, `total`) ao final.

4. Manter São Paulo como fuso oficial:
   - Continuar calculando recorrência e janela de envio em `America/Sao_Paulo`.
   - Não alterar UI, tabelas, RLS ou cron.

5. Validar após a alteração:
   - Deploy da edge function `scheduled-messages-runner`.
   - Executar manualmente um agendamento com falha usando `?id=<id>`.
   - Conferir `scheduled_message_deliveries` e logs da função para confirmar que a entrega mudou para `sent` ou registrou erro mais claro.