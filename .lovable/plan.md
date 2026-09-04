# Chamadas telefônicas pelo sistema (Twilio)

## Objetivo
Permitir fazer e receber ligações comuns (não WhatsApp) diretamente dentro do sistema, usando o número de telefone do escritório e a infraestrutura do Twilio.

## Escopo proposto — duas fases

### Fase 1: discagem click-to-call + histórico
- Conectar o connector Twilio ao projeto.
- Criar a tabela `call_logs` para registrar origem, destino, duração, status, gravação e usuário.
- Criar a edge function `twilio-call` para iniciar chamadas Twilio (`/Calls.json`).
  - Modo: o Twilio primeiro liga para o atendente e, ao atender, conecta ao cliente (ou o contrário, configurável).
  - Requer `TWILIO_FROM_NUMBER` e URLs TwiML hospedadas na edge function.
- Adicionar botão "Ligar" na ficha do cliente e no cabeçalho do chat quando houver `contact_phone`/`whatsapp_phone`.
- Listar histórico de chamadas na ficha do cliente.

### Fase 2: recebimento de chamadas
- Criar edge function `twilio-voice-webhook` para receber eventos do Twilio (`Incoming`, `StatusCallback`, `Recording`).
- Exibir notificação de chamada recebida no sistema (toast/painel) com opção de atender.
- Atendimento via WebRTC no browser usando `twilio-client` SDK — requer gerar Capability Token no backend.
- Registrar chamadas recebidas no mesmo `call_logs`.

## O que muda no banco
- Nova tabela `public.call_logs`:
  - `id uuid primary key default gen_random_uuid()`
  - `client_id uuid references clients(id) on delete set null`
  - `conversation_id uuid references chat_conversations(id) on delete set null`
  - `user_id uuid references auth.users(id) on delete set null`
  - `direction text not null` (`outbound` | `inbound`)
  - `from_number text not null`
  - `to_number text not null`
  - `twilio_call_sid text`
  - `status text not null` (`initiated`, `ringing`, `in-progress`, `completed`, `failed`, `no-answer`, `busy`, `canceled`)
  - `started_at timestamptz`
  - `answered_at timestamptz`
  - `ended_at timestamptz`
  - `duration_seconds int`
  - `recording_url text`
  - `notes text`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
- GRANTs padrão para `authenticated` e `service_role`.
- RLS: usuários autenticados veem apenas ligações vinculadas a conversas/clientes que podem acessar (ou, na primeira versão, todos os registros por serem funcionários do escritório).

## O que muda no backend (edge functions)
1. `twilio-call/index.ts`
   - Recebe `{ to: string, client_id?, conversation_id?, mode?: 'agent-first' | 'client-first' }`.
   - Valida usuário autenticado.
   - Chama Twilio `/Calls.json` via connector gateway com `Url` apontando para `twilio-voice-webhook` TwiML.
   - Insere registro inicial em `call_logs`.
2. `twilio-voice-webhook/index.ts`
   - Retorna TwiML XML (`<Response><Dial>...</Dial></Response>`) para conectar as pontas.
   - Recebe `StatusCallback` e atualiza `call_logs`.
   - Recebe `RecordingCallback` e salva URL da gravação.
   - Recebe chamadas `Incoming` e, na Fase 2, notifica/encaminha para fila de atendimento.
3. `twilio-client-token/index.ts` (Fase 2)
   - Gera Capability Token para o `twilio-client` SDK no browser atender chamadas.

## O que muda no frontend
- `src/pages/Clients.tsx`: botão de telefone na listagem/ficha; aba/histórico de chamadas.
- `src/components/chat/MessageArea.tsx`: botão "Ligar" ao lado do número de telefone no cabeçalho.
- `src/components/chat/CallDialog.tsx` (novo): mostra status da chamada, timer, botões de encerrar.
- `src/hooks/useTwilioClient.ts` (Fase 2): inicializa o `twilio-client` e gerencia estado de chamada recebida.

## Configurações e secrets
- Conectar o connector Twilio ao projeto via `standard_connectors--connect`.
- Secrets esperados: `TWILIO_API_KEY`, `LOVABLE_API_KEY` (gateway), `TWILIO_FROM_NUMBER`.
- Configurar no Twilio Console:
  - Voice webhook URL: `https://<supabase-project>.supabase.co/functions/v1/twilio-voice-webhook`
  - Status callback URL: mesma função com `?event=status`
  - Número de telefone comprado/verificado no Twilio.

## Critérios de aceitação
1. Usuário consegue clicar em "Ligar" a partir do chat ou da ficha do cliente.
2. O telefone do escritório toca; ao atender, a chamada é completada para o cliente.
3. Cada ligação gera um registro em `call_logs` com status atualizado.
4. Chamadas recebidas aparecem no sistema e podem ser atendidas (Fase 2).

## Riscos e dependências
- Requer conta Twilio ativa com saldo e número de telefone.
- Custos de voz por minuto conforme tarifa Twilio (Brasil).
- Receber chamadas no browser exige WebRTC e token dinâmico — Fase 2 é mais complexa.
- Número do escritório precisa estar disponível/configurável no Twilio.

## Sugestão de início
Começar pela Fase 1 (click-to-call), pois entrega valor imediato com menos complexidade e já prepara a estrutura para recebimento na Fase 2.
