## Por que a Gisele não respondeu

Investiguei a conversa de teste (Rafael Murilo) e o banco. Três coisas impedem a triagem hoje:

1. **Todas as conversas existentes ficaram com `triage_status='skipped'`** pela migration anterior (justamente para não re-triagar conversas antigas). Como o webhook só dispara quando o status é `pending` ou `in_progress`, **nenhuma conversa atual aciona a Gisele** — só contatos totalmente novos.
2. **Não há logs em `chat-triage-agent`** — confirma que o webhook nunca chamou a função.
3. **5 dos 6 departamentos estão sem `triage_keywords`** (só "Depto Fiscal" tem). Sem isso, a IA não tem como classificar e cairia sempre no fallback.

## Correções

### 1. Webhook: re-triar conversas sem atendente quando chega mensagem nova
Em `whatsapp-webhook/index.ts`, ampliar a condição que dispara o `chat-triage-agent`:

- Hoje: `assigned_to IS NULL AND triage_status IN ('pending','in_progress')`
- Novo: `assigned_to IS NULL AND triage_status IN ('pending','in_progress','skipped')` **e** `company_settings.triage_enabled = true`

Quando dispara em conversa `skipped`, o próprio `chat-triage-agent` reseta para `in_progress` no claim atômico (já faz isso).

### 2. Claim atômico aceita `skipped`
No `chat-triage-agent`, ajustar o `update ... where triage_status in (...)` para incluir `skipped` também (apenas no caminho disparado pelo webhook quando `assigned_to is null`). Mantém a proteção contra re-triar conversas que já foram fechadas com atendente.

### 3. Aviso de UX nas configurações
Em `DepartmentsTab.tsx`, mostrar um banner amarelo quando `triage_enabled=true` mas houver departamento sem `triage_keywords`, alertando que a IA pode não classificar corretamente sem palavras-chave.

### 4. Sanity-check ao salvar `triage_enabled`
Em `CompanyTab.tsx`, antes de salvar `triage_enabled=true`, verificar se há ao menos 1 departamento com keywords e se `triage_fallback_department_id` está preenchido. Se não, mostrar toast de aviso (não bloqueia, só alerta).

## Fora de escopo

- Não vou re-popular `triage_keywords` automaticamente — quem decide as palavras é o usuário, na aba Departamentos.
- Não vou disparar triagem retroativa em conversas antigas sem mensagem nova — a próxima mensagem do contato já vai acionar.

## Como testar depois

1. Preencher `triage_keywords` em pelo menos 2-3 departamentos.
2. Definir o departamento fallback em Configurações → Empresa.
3. Pedir para o Rafael mandar uma nova mensagem — a Gisele deve responder em 2-3s.
4. Acompanhar `Edge Functions → chat-triage-agent → Logs`.
