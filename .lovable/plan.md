## Diagnóstico encontrado

- O cron `scheduled-messages-runner` já está ativo e rodando a cada minuto (`* * * * *`).
- Os agendamentos de hoje foram processados no horário configurado, com `run` criado no banco.
- O problema atual não é mais o cron: as entregas falharam no envio WhatsApp.
- O cliente selecionado tem telefone salvo como `((4) 7) 3842-0299/ (0000) 0000-0000`; o runner apenas remove os caracteres não numéricos, gerando um número inválido para WhatsApp/Evolution API.
- A Evolution API respondeu `400 Bad Request`, e isso ficou registrado em `scheduled_message_deliveries` como `failed`.

## Plano de correção

1. **Manter o cron por minuto**
   - Confirmar no código e no banco que o job continua em `* * * * *`.
   - O cron só acorda o runner; quem decide disparar é a Edge Function, comparando dia e horário de São Paulo.

2. **Garantir disparo somente no dia e horário agendados**
   - Ajustar o runner para comparar `send_time` com o minuto atual em `America/Sao_Paulo`.
   - Usar tolerância mínima apenas contra atraso operacional do cron, sem transformar isso em janela de 30 minutos.
   - Manter idempotência: um agendamento só pode criar uma execução por data agendada.

3. **Corrigir validação de telefone antes do envio**
   - Criar uma normalização robusta para telefones brasileiros:
     - aceitar `55DDDNÚMERO`, `DDDNÚMERO` e variações com máscara;
     - separar múltiplos telefones digitados no mesmo campo;
     - escolher o primeiro número válido para WhatsApp;
     - rejeitar números fictícios como `0000` ou telefones incompletos.
   - Priorizar contato do departamento; se não existir, usar telefone principal do cliente.
   - Se não houver número válido, registrar `skipped` com erro claro: `Telefone inválido para WhatsApp`, em vez de tentar enviar para a Evolution API.

4. **Melhorar o registro de falhas**
   - Registrar no runner o motivo de cada agendamento ignorado ou processado: fora da data, fora do horário, já executado, sem cliente, sem telefone válido ou falha da Evolution API.
   - Melhorar o erro salvo em `scheduled_message_deliveries` para ficar legível na tela.

5. **Evitar reprocessamento incorreto**
   - Quando uma execução já existe no dia, não reenviar mensagens já enviadas.
   - Permitir retentar apenas entregas com status `failed` quando o runner for chamado de novo, sem duplicar mensagens enviadas.

6. **Validar após implementar**
   - Fazer uma chamada manual controlada do runner para verificar resposta e logs.
   - Conferir `scheduled_message_runs` e `scheduled_message_deliveries`.
   - Confirmar que o próximo agendamento no horário correto cria execução e entrega, ou registra uma falha clara caso o telefone seja inválido.