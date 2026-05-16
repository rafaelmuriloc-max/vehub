# Treinamento da Gisele com Prompts e Aprendizado

Decisões confirmadas:
- ✅ Manter o limite atual de 5 turnos
- ✅ Pré-popular `triage_system_prompt` e `triage_prompt` com base no conteúdo atual (descrição + keywords)
- ✅ Seleção simples por recência/balanceamento (sem embeddings)
- ✅ Janela de confirmação automática: **30 minutos** (antes era 24h)

## 1. Prompts editáveis

### Prompt global da Gisele
Novo campo `company_settings.triage_system_prompt` (text). Editável em **Configurações → Empresa** (nova seção "Triagem da Gisele"). Conterá persona, tom, regras, o que pode/não pode responder.

### Prompt por departamento
Em `departments`, adicionar coluna `triage_prompt` (text). Editado na aba Departamentos — substitui visualmente o campo de keywords (mantemos `triage_keywords` no banco por compatibilidade, mas oculto da UI).

A edge function `chat-triage-agent` passa a montar o system prompt assim:

```
[triage_system_prompt da empresa]

Departamentos disponíveis:
- <id> — <nome>: <triage_prompt>
...

Exemplos de triagens anteriores bem-sucedidas:
1. Cliente disse: "..." → Departamento: ...
...
```

## 2. Aprendizado contínuo

### 2a. Captura automática
Toda vez que a Gisele chama `transfer`, gravamos em nova tabela `triage_learnings`:
- `conversation_id`, `user_messages` (texto do cliente até a transferência), `chosen_department_id`, `summary`, `outcome` (`auto_confirmed` | `corrected` | `rejected`), `corrected_department_id`, `created_at`, `confirmed_at`

Também setamos `chat_conversations.triaged_department_id` para detectar reatribuição posterior.

### 2b. Confirmação automática (30 min)
Novo cron `triage-learning-reconcile` rodando a cada **5 minutos**:
- Para learnings com `outcome=auto_confirmed` criados há **>30 min**: verifica se o departamento atual da conversa ainda bate. Se admin/atendente moveu para outro depto, marca `outcome=corrected` + `corrected_department_id`. Se foi rejeitado/fechado sem aceitar, marca `rejected`.

### 2c. Correção manual
No cabeçalho do chat (quando triada pela Gisele), botão "Corrigir triagem" → escolhe o depto certo. Move a conversa e grava `corrected` em `triage_learnings`.

### 2d. Few-shot no prompt
A cada execução, a função busca até **8 exemplos** de `triage_learnings`:
- `outcome in ('auto_confirmed','corrected')`
- mais recentes, balanceados por departamento (usando `corrected_department_id` quando houver)
- Injeta no system prompt como exemplos texto → departamento

### 2e. Painel "Treinamento da Gisele" (Configurações)
Nova aba mostra:
- Total de triagens nas últimas 30 dias, taxa de acerto (auto_confirmed/total)
- Lista das últimas correções (mensagem do cliente, departamento escolhido pela Gisele × departamento correto)
- Botão "Esquecer" para remover ruído da base de aprendizado

## 3. Mudanças técnicas

**Migration (schema):**
- `ALTER TABLE company_settings ADD COLUMN triage_system_prompt text`
- `ALTER TABLE departments ADD COLUMN triage_prompt text`
- `ALTER TABLE chat_conversations ADD COLUMN triaged_department_id uuid`
- `CREATE TABLE triage_learnings (...)` com RLS: admins leem/deletam, service role insere/atualiza

**Migration (data, via insert tool):**
- Popular `triage_system_prompt` com prompt padrão da Gisele (baseado no system prompt atual codado na edge function)
- Popular `departments.triage_prompt` concatenando `description` + `triage_keywords` quando existirem

**Edge function `chat-triage-agent`:**
- Montar system prompt a partir de `triage_system_prompt` + `departments.triage_prompt`
- Buscar e injetar exemplos de `triage_learnings`
- Ao executar `transfer`, gravar em `triage_learnings` (`outcome=auto_confirmed`) e setar `triaged_department_id`

**Nova edge function `triage-learning-reconcile`** + cron a cada 5 minutos (via insert tool — não migration — porque contém URL do projeto e anon key).

**Frontend:**
- `CompanyTab.tsx`: nova seção "Triagem da Gisele" com textarea grande para `triage_system_prompt`
- `DepartmentsTab.tsx`: substituir textarea de keywords por textarea de `triage_prompt` com legenda explicativa
- `MessageArea.tsx` (cabeçalho do chat): botão "Corrigir triagem" condicional
- `Settings.tsx`: nova aba "Treinamento Gisele" com métricas e correções

## Próximo passo
Ao aprovar, vou rodar a migration de schema, depois popular os dados padrão e criar/atualizar a edge function + UI.
