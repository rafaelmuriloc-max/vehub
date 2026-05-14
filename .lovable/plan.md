## Objetivo

Ampliar a Gisele para fazer **primeiro atendimento + triagem** em toda mensagem nova de contato sem atendente atribuído (em qualquer horário). Ela conversa livremente até identificar com confiança o departamento responsável, transfere a conversa para um atendente daquele departamento (round-robin) e avisa o cliente.

## Como vai funcionar (fluxo)

```text
Mensagem entra (whatsapp-webhook)
        │
        ├─ assigned_to != NULL  → segue normal
        │
        └─ assigned_to == NULL  → dispara `chat-triage-agent` (fire-and-forget)
                │
                ├─ Carrega histórico da conversa + descrição dos departamentos
                ├─ Chama Lovable AI (google/gemini-2.5-flash) com tool-calling:
                │     • tool `ask_user(text)`        → continua a conversa
                │     • tool `transfer(department_id, summary)` → encerra triagem
                │
                ├─ Se ask_user → envia mensagem como Gisele via Evolution API
                │                grava no chat com sender_id = agente sintético
                │
                └─ Se transfer → escolhe atendente do depto (round-robin),
                                 atualiza chat_conversations.assigned_to,
                                 envia ao cliente: "Transferindo para {Depto}.
                                 Em breve {Atendente} vai te atender."
                                 grava nota interna com `summary` da IA
```

## Mudanças

### 1. Banco de dados
- `chat_conversations`:
  - `triage_status text default 'pending'` — `pending | in_progress | done | skipped`
  - `triage_department_id uuid` — depto sugerido pela IA
  - `triage_summary text` — resumo do que o cliente quer
- `departments`:
  - `triage_keywords text` — descrição livre que a IA usa para decidir (ex.: "Fiscal: notas fiscais, impostos, NFe, ICMS"). Editável na aba Departamentos.
- `profiles`:
  - já tem `department_id`. Triagem só sorteia entre `profiles` com `department_id = X` que tenham role `employee` ou `admin` ativos.
- Round-robin: usar `chat_conversations` recentes (últimas 24h) por `assigned_to` no depto e escolher quem tem menos conversas abertas; em empate, ordem alfabética. Sem nova tabela.

### 2. Edge function `chat-triage-agent` (nova)
- Input: `{ conversation_id }`.
- Lê mensagens da conversa (até 30 últimas), settings da empresa (`agent_name`), lista de departamentos (id, name, triage_keywords).
- Chama `LOVABLE_API_KEY` em `https://ai.gateway.lovable.dev/v1/chat/completions` com `google/gemini-2.5-flash` e `tools` (function calling):
  - `ask_user({ text })`
  - `transfer({ department_id, summary })`
- System prompt curto: "Você é {agent_name}, recepcionista da Velocitä. Cumprimente, descubra o departamento, transfira. Não responda dúvidas técnicas."
- Limite de segurança: máximo 5 turnos da Gisele por conversa (evita loop). Se exceder, transfere para depto "Geral" (configurável em `company_settings.triage_fallback_department_id`).
- Trata 429/402 como no `whatsapp-transcribe-audio`.

### 3. `whatsapp-webhook/index.ts`
- Após inserir mensagem, se `!isFromMe` E `chat_conversations.assigned_to IS NULL` E (não é grupo) E (`triage_status` ∈ `pending|in_progress`):
  - chama `chat-triage-agent` fire-and-forget.
- Remove a chamada atual de `maybeSendOffHoursReply` para conversas que vão entrar em triagem (Gisele assume o primeiro contato em qualquer horário). Mantém off-hours só como fallback se a IA falhar.

### 4. Mensagens da Gisele
- Enviadas via Evolution API (mesmo path do off-hours atual).
- Inseridas em `chat_messages` com `message_type='whatsapp_outgoing'`, `sender_id` = id de um "usuário sistema" (criar em `profiles` com `full_name='Gisele'` e `tag_color`). Sufixo VHUB_MARKER já garante anti-eco.

### 5. UI
- `CompanyTab` (Atendimento): adicionar toggle **"Triagem automática pela {agent_name}"** + select de depto fallback.
- `DepartmentsTab`: adicionar campo **"Palavras-chave / descrição p/ triagem IA"** (textarea).
- `Chat` (header da conversa): badge "Em triagem" quando `triage_status='in_progress'`. Botão "Assumir agora" para o atendente cancelar a triagem manualmente (`triage_status='skipped'` e `assigned_to=auth.uid()`).

## Detalhes técnicos

- **Modelo**: `google/gemini-2.5-flash` (rápido, suporta tools, gratuito até 13/out/2025 no Lovable AI Gateway).
- **Echo prevention**: as mensagens enviadas pela Gisele recebem o `VHUB_MARKER` no final (`\u200B\u200B\u200B`) — já tratado no webhook.
- **Concorrência**: usar `update ... where triage_status='pending' returning id` para garantir que duas execuções simultâneas não dupliquem resposta.
- **Realtime**: o front já escuta `chat_conversations` e `chat_messages`; nada novo aqui.
- **Custos/limites**: cada conversa nova = 1–5 chamadas de LLM. Para Velocitä volume é baixo, OK.

## Fora de escopo

- Responder FAQs ou consultar dados do cliente (boletos, certidões). Pode ser segunda fase.
- Triagem em conversas de grupo.
- Re-triagem após o atendente fechar o ticket.
