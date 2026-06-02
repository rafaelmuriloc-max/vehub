
# Mensagens Agendadas no Chat

Nova funcionalidade para programar mensagens recorrentes que são enviadas automaticamente para os clientes via WhatsApp (mesmo canal já usado pelo chat), com registro no chat do cliente e em log de execuções.

## Resumo do comportamento

- Admin cria um "Agendamento de Mensagem" definindo: departamento, periodicidade, dia/hora, regra de seleção de clientes, texto da mensagem e anexo opcional.
- Um cron job dispara a cada 15 min, calcula quais agendamentos têm execução prevista para a janela atual (BRT) e enfileira o envio para cada cliente elegível.
- Para cada cliente, busca o contato do departamento (`client_department_contacts`) e envia via WhatsApp Meta API (mesma rota usada hoje pelo chat). Anexo é enviado como mídia.
- A mensagem aparece no chat do cliente (cria a conversa caso ainda não exista) como `whatsapp_outgoing`, com `agent_name = "Agendador"` e o marker VHUB para evitar eco.
- Data que cai em fim de semana/feriado é **antecipada** para o dia útil anterior (mesma regra já usada em obrigações — `previousBusinessDay`).

## Tela / UX

Nova entrada no menu lateral em **Comunicação → Mensagens Agendadas** (`/scheduled-messages`), apenas admin.

Listagem em tabela com colunas: Nome, Departamento, Periodicidade, Próxima execução, Clientes, Status (ativo/pausado), Última execução, ações (Editar / Pausar / Duplicar / Excluir / Ver histórico).

Dialog de criação/edição em abas:
1. **Configuração**
   - Nome interno do agendamento
   - Departamento (Select de `departments`)
   - Periodicidade: Diária, Semanal (com dia da semana), Mensal (dia do mês), Trimestral, Anual (mês + dia), "Escolher meses" (multi-select de meses + dia)
   - Hora (HH:MM, fuso `America/Sao_Paulo`)
   - Switch "Antecipar quando cair em fim de semana/feriado" (default ON)
   - Data fim opcional
2. **Clientes** — mesma UX do dialog de obrigações em `Obligations.tsx` (componente reaproveitado):
   - Modo "Todas as empresas"
   - Modo "Por segmento" (regime tributário, folha, cidade)
   - Modo "Manual" (lista com busca + checkboxes)
3. **Mensagem**
   - Textarea com suporte a variáveis `{{cliente}}`, `{{departamento}}`, `{{data}}`
   - Upload de anexo opcional (imagem, PDF, doc) — armazenado em `chat-media`
   - Preview do destinatário (contato do departamento)
4. **Revisão** — mostra total de clientes elegíveis e próxima data de disparo.

Drawer "Histórico" lista execuções (`scheduled_message_runs`) com status por cliente (enviado, falhou, sem contato).

## Modelo de dados (Supabase)

Novas tabelas em `public`:

- `scheduled_messages`
  - `id`, `name`, `department_id`, `recurrence` (`daily|weekly|monthly|quarterly|yearly|custom_months`),
  - `weekly_day` (0–6 nullable), `monthly_day` (1–31), `annual_month`, `custom_months` (int[]),
  - `send_time` (time), `anticipate_weekend` (bool, default true),
  - `assignment_mode` (`all|segment|manual`), `segment_filters` (jsonb),
  - `message_body` (text), `attachment_url`, `attachment_name`, `attachment_mime`,
  - `start_date`, `end_date`, `active` (bool), `last_run_at`, `next_run_at`,
  - `created_by`, timestamps.
- `scheduled_message_clients` (modo manual): `scheduled_message_id`, `client_id`.
- `scheduled_message_runs`: `id`, `scheduled_message_id`, `run_at`, `status_summary` (jsonb), `created_at`.
- `scheduled_message_deliveries`: `id`, `run_id`, `client_id`, `status` (`sent|failed|skipped`), `error`, `chat_message_id`, `sent_at`.

RLS:
- `scheduled_messages` + `scheduled_message_clients`: leitura para `authenticated` filtrada por `user_can_access_department`; INSERT/UPDATE/DELETE apenas admin.
- `scheduled_message_runs` / `_deliveries`: SELECT para authenticated com filtro por departamento (via join); INSERT só pelo service_role (edge function).
- GRANTs padrão (authenticated + service_role) na mesma migration.

## Edge functions

- `scheduled-messages-runner` (chamada por cron pg a cada 15 min):
  - Lê BRT atual; para cada `scheduled_messages.active=true`, computa a data prevista da próxima execução considerando `anticipate_weekend` (usa lib equivalente a `previousBusinessDay`).
  - Se `next_run_at <= now()`, cria `scheduled_message_runs` e enfileira deliveries.
  - Para cada cliente elegível, resolve contato em `client_department_contacts(department_id)`. Sem telefone → marca `skipped`.
  - Envia via WhatsApp Meta API (reaproveita helper já usado pela função `whatsapp-send-text` / `whatsapp-send-media`). Anexo → media. Texto puro → mensagem.
  - Insere mensagem em `chat_messages` (`message_type='whatsapp_outgoing'`, `agent_name='Agendador'`, conteúdo com sufixo `VHUB_MARKER`); cria `chat_conversations` caso não exista para o telefone.
  - Atualiza `last_run_at` e recalcula `next_run_at`.
- `scheduled-message-preview` (opcional, GET): retorna lista de clientes elegíveis para o dialog.

Cron via `pg_cron` + `pg_net` (inserido pela ferramenta de inserts — não migration, pois usa anon key específico do projeto).

## Frontend

Novos arquivos:
- `src/pages/ScheduledMessages.tsx` — listagem.
- `src/components/scheduled/ScheduledMessageDialog.tsx` — dialog 4 abas.
- `src/components/scheduled/ScheduledMessageHistory.tsx` — drawer de histórico.
- Reaproveita o bloco de seleção de clientes do `Obligations.tsx` extraído para `src/components/shared/ClientAssignmentSelector.tsx` (refactor leve — somente extração).

Rota nova em `src/App.tsx` e item no `AppSidebar.tsx` (grupo "Comunicação").

## Itens técnicos

- Anexos salvos no bucket existente `chat-media` (já público) sob `scheduled/{id}/...`, com sanitização de nome (regra de Storage Conventions).
- Cálculo de `next_run_at`: utilitário puro em `supabase/functions/_shared/scheduling.ts` (não cria pasta nova; pode ficar inline na função runner se preferir manter o padrão atual do projeto).
- Helper de feriados: portar a lógica de `src/lib/holidays.ts` para Deno dentro do runner (sem dependência cruzada com src/).
- Idempotência: chave única `(scheduled_message_id, run_at::date, run_at::hour)` em `scheduled_message_runs` evita disparo duplicado se o cron rodar duas vezes na mesma janela.
- Cota de envio Meta API: respeitar throttling existente; o runner envia em série com pequeno `await` entre destinatários.

## Memória a atualizar após implementação

Criar `mem://features/chat/scheduled-messages.md` descrevendo: tabelas, runner, regra de antecipação para dia útil anterior, registro no chat com marker VHUB e contato do departamento como destinatário; adicionar referência no índice.
