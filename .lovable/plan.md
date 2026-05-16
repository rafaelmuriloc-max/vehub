# Gerenciador de E-mail estilo Gmail — caixa única do escritório

## Resumo
Conectar **uma única conta Gmail** do escritório via conector Gmail OAuth da Lovable. Toda a equipe acessa essa caixa centralizada na página `/email` com UI estilo Gmail em 3 colunas. Configuração feita em **Cadastro → Meu Escritório**.

## 1. Banco de dados (migração)

### `company_settings` (alterar)
- `gmail_connected_email` text — e-mail conectado (apenas exibição/auditoria).
- `gmail_last_history_id` text — último `historyId` sincronizado (sync incremental).
- `gmail_last_sync_at` timestamptz — última execução do sync.

### `email_messages` (nova)
Campos principais:
- `gmail_message_id` text UNIQUE, `gmail_thread_id` text
- `from_email`, `from_name`, `to_emails text[]`, `cc_emails text[]`
- `subject`, `snippet`, `body_html`, `body_text`
- `received_at` timestamptz
- `is_read`, `is_starred`, `is_archived`, `is_trashed`, `is_sent` booleans
- `has_attachments` bool
- `labels text[]`
- `client_id uuid` (vínculo opcional)

### `email_attachments` (nova)
`message_id`, `filename`, `mime_type`, `size_bytes`, `gmail_attachment_id`, `storage_path` (preenchido após download lazy).

### RLS
- SELECT: qualquer `authenticated`.
- UPDATE (lido/estrela/arquivar/lixeira/vincular cliente): `authenticated`.
- INSERT/DELETE: somente service_role (via Edge Function).

### Storage bucket
- `email-attachments` (privado).

## 2. Conectar Gmail
Chamada única ao `standard_connectors--connect("google_mail")` com escopos `gmail.readonly`, `gmail.send`, `gmail.modify`. Gera o secret `GOOGLE_MAIL_API_KEY`.

## 3. Edge Functions
Todas usam `https://connector-gateway.lovable.dev/google_mail/gmail/v1/...` com headers `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_MAIL_API_KEY}`.

| Função | Descrição |
|---|---|
| `gmail-sync` | Se `gmail_last_history_id` existe → `users.me/history.list?startHistoryId=...`. Senão → `users.me/messages.list?q=newer_than:30d`. Para cada mensagem nova, busca `format=full`, parseia headers/corpo (text/html), salva em `email_messages` + metadados de anexos em `email_attachments`. Atualiza `gmail_last_history_id` e `gmail_last_sync_at`. |
| `gmail-send` | Compor/responder/encaminhar via `users.me/messages/send`. Monta MIME RFC 2822 com headers `In-Reply-To` e `References` para respostas. Suporta anexos (upload prévio para `email-attachments`). Insere espelho local marcado `is_sent=true`. |
| `gmail-modify` | Ações: lido/não-lido, estrela, arquivar (remove `INBOX`), lixeira (`messages/{id}/trash`), restaurar (`untrash`). Espelha em `email_messages` e via gateway. |
| `gmail-attachment` | Download lazy: `messages/{id}/attachments/{aid}` → salva no bucket → retorna signed URL. |

### Cron
pg_cron a cada 2 min → `gmail-sync` (SQL via insert tool, contém anon key).

## 4. UI — `src/pages/Meu Escritório` (Settings)
Nova seção **"E-mail Central"** dentro da página de cadastro do escritório:
- Estado "Não conectado" → botão "Conectar Gmail do escritório".
- Estado "Conectado" → mostra e-mail conectado, última sync, botão "Sincronizar agora", botão "Desconectar".

(O agente intermedia: o botão de conectar dispara o fluxo do conector Gmail.)

## 5. UI — `src/pages/Email.tsx` (reescrita completa, 3 colunas)

```text
+-----------------------------------------------------------------+
| [✎ Compor]                                          [🔄 Sync]    |
|-----------------------------------------------------------------|
| 220px            | 400px                  | flex                 |
|------------------|------------------------|----------------------|
| 📥 Caixa entrada | [🔍 buscar]            | [⭐][📁][🗑️][↩️][↪️]  |
| ⭐ Com estrela   | ────────────           |                      |
| 📤 Enviados      | Remet · Assunto        | De: ...              |
| 📁 Arquivados    | snippet…       12:34   | Para: ... · 12:34    |
| 🗑️ Lixeira       | ────────────           | Assunto              |
|                  | Remet · Assunto        | ────                 |
| ─── Vínculos ─── | snippet…       Ontem   | Corpo HTML (iframe   |
| 🏢 Por cliente   |                        |  sandboxed)          |
|                  | …                      | [📎 anexos]          |
|                  |                        | [🏢 Vincular cliente]|
+-----------------------------------------------------------------+
```

Componentes novos em `src/components/email/`:
- `EmailSidebar.tsx` — pastas + filtro por cliente.
- `EmailList.tsx` — lista paginada (50 por página), busca client-side por assunto/from/snippet; ícone de anexo; bold se não-lida.
- `EmailReader.tsx` — renderiza HTML em `<iframe sandbox>` para segurança; barra de ações; download de anexos via `gmail-attachment`.
- `EmailCompose.tsx` — Dialog com to/cc/assunto/corpo + input de anexos. Em "Responder/Encaminhar" pré-preenche.
- `ClientLinkPopover.tsx` — Combobox para escolher cliente e gravar `client_id`.

Realtime: subscription `email_messages` (postgres_changes INSERT/UPDATE) para refletir novas mensagens e mudanças de estado sem refresh.

## 6. Limpeza / referências
- Remover a tela atual de "Compor" + "Enviados" (era SMTP departamental). Os logs antigos em `email_logs` ficam intactos e são preservados (usados pelo rastreamento de pixel em outras automações).
- A página `/email` agora é o gerenciador estilo Gmail. Item de sidebar mantido.

## 7. Itens NÃO incluídos
- Threads/conversas agrupadas (escopo "Completo sem threads").
- Push em tempo real do Gmail via Pub/Sub (usamos cron 2 min).
- Filtros/regras automáticas.
- Múltiplas contas (apenas 1 caixa central).

## 8. Ordem de implementação
1. Migration: alterações em `company_settings`, novas tabelas + RLS + bucket.
2. Conectar Gmail OAuth (`standard_connectors--connect`).
3. Edge functions `gmail-sync`, `gmail-send`, `gmail-modify`, `gmail-attachment`.
4. Cron 2 min via insert tool.
5. Seção "E-mail Central" em Meu Escritório.
6. Reescrita da página `/email` com 3 colunas e componentes.
7. Disparar `gmail-sync` inicial.

## Avisos ao usuário
- A conta Gmail conectada é única para o escritório — toda a equipe vê os mesmos e-mails (sem isolamento por departamento).
- Sync inicial limitado aos últimos 30 dias para evitar carga; mensagens novas chegam a cada 2 min.
- Não suporta Outlook/Hostinger nesta versão.
