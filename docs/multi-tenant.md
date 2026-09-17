# Multi-tenant por escritório + login Google — estado da implementação

Nada foi aplicado ao banco de produção, nenhuma função foi implantada e o
provider Google não foi ativado. Todo o código novo está inerte por padrão.

## 1. Diagnóstico (somente leitura, verificado no banco)

- Banco: Supabase **externo** do proprietário, projeto `ismgjjvarzzfsbdpthot`,
  PostgreSQL 17.6. O MCP responde `database_not_managed` porque não é gerenciado
  pela plataforma. Inspeção possível apenas em leitura (`supabase_read_only_user`).
- 8 usuários / 8 perfis / 8 papéis; 230 clientes; 6 departamentos;
  **1 único** registro em `company_settings`; 4 buckets com 16.271 arquivos;
  11 jobs de `pg_cron`; 64 edge functions.
- **Isolamento parcial: inexistente.** Nenhuma coluna, tabela ou conceito de
  organização no banco nem no código. A separação atual é por departamento e
  por papel, dentro de um único escritório.
- Das 56 tabelas com RLS, a maioria tem ao menos uma política `USING (true)`
  para qualquer autenticado (clientes, tarefas, financeiro, chat, notas, documentos).
- `handle_new_user` concede perfil **e papel `employee`** a qualquer conta nova:
  ligar o Google sem corrigir isso faria qualquer conta Google entrar no escritório.
- `verify_jwt=false` no `config.toml` não é prova de ausência de autenticação:
  `manage-user`, por exemplo, valida o JWT e checa `has_role` no handler. A
  auditoria função a função continua pendente (ver §6).

## 2. O que foi implementado nesta execução

Migrações versionadas em `supabase/multitenant/` (**não aplicadas**):

| Arquivo | Conteúdo |
|---|---|
| `001_core_organizations.sql` | `organizations`, `organization_members`, `organization_member_departments`, `organization_invites`, `organization_integrations`; funções `is_org_member`, `org_role`, `is_org_admin`, `current_org_id`, `member_can_access_department`; grants e RLS |
| `002_add_org_id_columns.sql` | `org_id` nulável + índices em 56 tabelas (passo não destrutivo) |
| `003_backfill_and_enforce.sql` | Cria a organização do escritório atual, migra os 8 usuários e seus departamentos, preenche `org_id` em tudo, aplica `NOT NULL` + `default current_org_id()`, e instala o gatilho `assert_same_org` em 18 relacionamentos |
| `004_rls_org_isolation.sql` | Apaga as políticas abertas e recria tudo com `org_id = current_org_id()`; refinamentos por departamento; RPCs `get_calendar_month_completions`, `dashboard_*`, `get_chat_inbox`, `delete_conversation_cascade`, `resolve_client_by_phone` filtrando por organização |
| `005_storage_legacy_paths.sql` | Políticas de storage por organização **sem mover arquivos**: caminhos legados mapeados exclusivamente ao escritório existente; gravação nova obrigatoriamente sob `{org_id}/` |
| `006_auth_invites_no_autojoin.sql` | `handle_new_user` sem concessão automática; `has_role` legado passa a ser por organização; `create_org_invite` (token de 32 bytes, só o hash é gravado), `accept_org_invite` (uso único, expirável, exige e-mail verificado na sessão), `remove_org_member` (desativa o vínculo, nunca apaga `auth.users`), `my_organizations` |
| `007_cron_webhooks_credentials.sql` | `resolve_org_by_integration` (retorna NULL quando ambíguo), `active_org_ids`, `org_job_runs` para idempotência dos jobs por escritório |
| `999_rollback.sql` | Reversão, com aviso de dump das políticas antes do passo 004 |

Código de aplicação:

- `src/lib/tenant.ts` — flags `VITE_MULTI_TENANT` e `VITE_ENABLE_GOOGLE_AUTH`
  (ambas desligadas), helpers de caminho de storage, validação de token de
  convite e URL de callback.
- `src/hooks/useOrganization.tsx` — contexto de organização ativa, troca de
  escritório, `isOrgAdmin` por organização, estado "sem acesso". Degrada em
  silêncio se a RPC ainda não existir: **não quebra produção antes do schema**.
- `supabase/functions/_shared/tenant.ts` — `requireCaller` (valida JWT no
  handler), `requireOrgAdmin`, `resolveOrgForWebhook` (ambíguo ⇒ null ⇒ 400),
  `orgSecret` (falha se a organização não tiver credencial própria; nunca herda).
- `src/pages/Auth.tsx` — botão "Entrar com Google" atrás das duas flags.

## 3. O que foi testado

- `bun run build` e `bunx tsgo --noEmit`: sem erros.
- `src/lib/tenant.test.ts` (vitest): prefixo de storage por organização, rejeição
  de organização inválida, identificação de caminho legado, mapeamento legado
  exclusivo ao escritório existente e formato do token de convite.
- `supabase/multitenant/tests/isolation_tests.sql`: 8 cenários — isolamento
  entre duas organizações, insert cross-tenant via API, membro removido perde
  acesso, funcionário não se promove e admin de A não é admin em B,
  relacionamento cross-tenant bloqueado, mapeamento de storage legado, convite
  de uso único e convite recusado para outro e-mail.
  **Ainda não executado**: exige um banco de staging com permissão de escrita;
  o banco conectado é somente leitura.

## 4. Etapas manuais pendentes

1. Criar um **staging** (restaurar dump de produção) e rodar 001→007 na ordem,
   depois `tests/isolation_tests.sql`.
2. Dump das políticas antes do passo 004 (comando no `999_rollback.sql`).
3. Backup completo antes do passo 003.
4. Google Cloud: projeto, tela de consentimento publicada (política de
   privacidade e termos), credencial OAuth "Aplicativo Web" com
   **Origens autorizadas**: `https://vehub.lovable.app` e a URL de preview;
   **URI de redirecionamento autorizado**:
   `https://ismgjjvarzzfsbdpthot.supabase.co/auth/v1/callback`
   (o callback é do Supabase, não do app — o app só recebe o retorno em
   `/auth/callback`).
5. Supabase → Authentication → Providers → Google: colar client ID/secret;
   conferir Site URL e Redirect URLs (`.../auth/callback`).
6. Provisionar os secrets por escritório com sufixo (`ASAAS_API_KEY__<SLUG>`,
   `EVOLUTION_API_KEY__<SLUG>` …) e registrar os **nomes** em
   `organization_integrations.secret_names`.
7. Só então ligar `VITE_MULTI_TENANT=true` e, por último,
   `VITE_ENABLE_GOOGLE_AUTH=true`.

## 5. Ordem de implantação segura

```text
1. deploy do frontend (flags off)        -> produção inalterada
2. 001 + 002 em produção                 -> não destrutivo, nada muda
3. backup + 003                          -> backfill do escritório atual
4. dump de políticas + 004 + 005         -> isolamento entra em vigor
5. 006                                   -> fim do ingresso automático
6. adequação das edge functions + 007    -> cron e webhooks por escritório
7. VITE_MULTI_TENANT=true
8. provider Google + VITE_ENABLE_GOOGLE_AUTH=true
```

## 6. Inventário de pendências — **o multi-tenant NÃO está concluído**

Módulos ainda sem isolamento implementado:

- **64 edge functions**: apenas o helper compartilhado foi escrito. Cada função
  precisa ser migrada individualmente para `requireCaller`/`orgSecret`, com
  auditoria caso a caso do que o handler realmente valida hoje.
- **Webhooks** (`whatsapp-webhook`, `asaas-webhook`, `email-track`,
  `document-public-link`): falta validação própria de assinatura e o uso de
  `resolveOrgForWebhook`; hoje não há como distinguir escritórios.
- **11 jobs de `pg_cron`**: continuam globais; falta iterar `active_org_ids()`.
- **Telas**: nenhuma página passou a filtrar por organização nem existe seletor
  de escritório ou rota "sem acesso" — depende de `004` estar aplicado.
- **`manage-user`**: ainda usa `has_role` e `auth.admin.deleteUser`; precisa
  passar a `remove_org_member` e a convites.
- **Cache e realtime**: `integra_contador_cache` e as publicações do realtime
  precisam de verificação após a aplicação do `004`.
- **`chat-media` público**: leitura anônima por URL permanece; decisão pendente.
- **Reconciliação de identidade Google** para os 8 usuários atuais: deve ser
  feita pelo fluxo oficial do Supabase (o usuário faz login com Google usando o
  mesmo e-mail já confirmado), **sem vínculo manual**.
