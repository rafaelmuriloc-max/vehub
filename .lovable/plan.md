# Multi-escritório (multi-tenant) + login com Google — diagnóstico e plano

## 1. Diagnóstico do estado atual (somente leitura, feito agora)

**Qual banco é usado e se consigo inspecioná-lo**
- O sistema usa um Supabase externo (do proprietário), projeto `ismgjjvarzzfsbdpthot`, PostgreSQL 17.6. É por isso que o MCP respondeu `database_not_managed`: o banco não é gerenciado pela plataforma.
- Consigo sim inspecioná-lo, em modo leitura (usuário de consulta `supabase_read_only_user`). Nenhum dado, código ou configuração foi alterado. Nenhum segredo foi lido ou exibido.

**Números reais encontrados**
- 8 usuários, 8 registros de papel (admin/funcionário), 8 perfis.
- 230 clientes, 6 departamentos, **1 único registro de dados do escritório** (`company_settings`).
- 56 tabelas com regras de acesso ativas, 4 áreas de arquivos (16.271 arquivos), 11 rotinas agendadas, 64 funções de servidor.

**Isolamento parcial existente: praticamente nenhum**
- Não existe nenhuma coluna, tabela ou conceito de escritório/organização em lugar algum do banco nem do código.
- A separação que existe hoje é apenas por **departamento** (Fiscal, Contábil, Pessoal) e por **papel** (admin/funcionário) — é filtro interno de um único escritório, não isolamento entre escritórios.
- A maioria das regras de leitura hoje é "qualquer usuário logado vê tudo": das 56 tabelas, a maior parte tem pelo menos uma regra aberta a todos os autenticados (clientes, tarefas, financeiro, chat, notas fiscais, documentos etc.).
- `company_settings` guarda um escritório só (dados, certificado, e-mail, WhatsApp), sem chave de dono.

**Autenticação hoje**
- Só e-mail e senha. Não há login com Google em lugar nenhum do código.
- **Ponto crítico:** existe uma rotina automática que, a cada novo cadastro no sistema de login, já cria o perfil e concede o papel de funcionário. Se o login com Google for ligado do jeito que está, **qualquer conta Google entraria no escritório automaticamente e enxergaria os dados dos 230 clientes**. Isso precisa ser bloqueado antes de habilitar o Google.

**Funções de servidor, agendamentos e integrações**
- 64 funções de servidor; quase todas estão declaradas como abertas (sem exigir login) em `supabase/config.toml`, incluindo webhooks do WhatsApp, Asaas, e-mail e rotinas de sincronização. Várias usam a chave administrativa e ignoram regras de acesso — elas precisam passar a receber e respeitar o escritório.
- 11 rotinas agendadas (mensagens programadas, sincronizações de notas, alertas de chat, certificados) rodam para o sistema inteiro, sem noção de escritório.
- Integrações externas com credenciais únicas: WhatsApp (Meta e Evolution), Asaas, SERPRO/Integra Contador, Gmail/Drive, proxy de NF-e. Hoje são de um escritório só; no modelo multi-escritório cada um precisa das próprias credenciais.

## 2. Plano de migração proposto (preservando dados e acessos)

**Etapa A — Estrutura de organizações (sem mudar comportamento)**
1. Criar `organizations` (escritórios) e `organization_members` (quem pertence a qual escritório e com qual papel).
2. Criar o escritório "Velocitä Contabilidade" a partir do registro atual e vincular os 8 usuários existentes como membros, preservando admin/funcionário.
3. Adicionar a coluna de escritório em todas as tabelas de dados e preencher tudo com esse escritório. Nada muda para quem já usa hoje.

**Etapa B — Isolamento real**
4. Reescrever as regras de acesso: em vez de "qualquer usuário logado vê tudo", passa a ser "vê apenas o que é do seu escritório". Os filtros por departamento e papel continuam valendo dentro do escritório.
5. Ajustar as áreas de arquivos para o mesmo critério e organizar caminhos por escritório.
6. Ajustar funções de servidor, webhooks e rotinas agendadas para operar por escritório, incluindo as credenciais de integração de cada um.
7. Ajustar as telas para trabalharem com o escritório do usuário (e permitir troca, se ele pertencer a mais de um).

**Etapa C — Login com Google, sem ingresso automático**
8. Remover a concessão automática de acesso a todo novo cadastro. Quem entra pelo Google e não é membro de nenhum escritório cai numa tela de "sem acesso".
9. Entrada só por **convite** feito por um administrador (por e-mail) ou por **domínio autorizado** aprovado pelo escritório. O convite define o papel e os departamentos.
10. Botão "Entrar com Google" na tela de login, convivendo com e-mail e senha; contas com o mesmo e-mail são reconciliadas.

## 3. Configuração manual necessária para o Google (fora do código)
- Criar projeto e credenciais OAuth no Google Cloud, com a tela de consentimento publicada (política de privacidade e termos).
- Autorizar o domínio do projeto Supabase e as URLs do sistema (preview, publicado e domínio próprio).
- Colar ID e segredo do cliente no painel do Supabase (Authentication → Providers → Google) e conferir Site URL e Redirect URLs.
- Isso é feito pelo proprietário no painel; eu não tenho acesso a esse projeto externo.

## 4. Dependências e riscos
- É uma mudança ampla: toca 56 tabelas, 64 funções, 11 agendamentos e praticamente todas as telas. Recomendo executar por etapas, com validação a cada uma.
- Recomendo backup antes da Etapa A e uma janela de baixa utilização para a Etapa B.
- As integrações (WhatsApp, Asaas, SERPRO, Gmail) precisam de definição: continuam compartilhadas no início ou já passam a ser por escritório? Assumo compartilhadas na Etapa A e por escritório na Etapa B.

## 5. Detalhes técnicos
- `organizations(id, name, slug, created_at)`; `organization_members(org_id, user_id, role app_role, departments)`; `organization_invites(org_id, email, role, token, expires_at, accepted_at)`; `organization_domains(org_id, domain, auto_join bool)`.
- Funções `current_org_id()` e `is_org_member(_user, _org)` como `SECURITY DEFINER STABLE` com `search_path` fixo, usadas nas políticas; `has_role` e `user_can_access_department` passam a ser avaliadas dentro do escritório.
- `org_id uuid not null` em todas as tabelas de domínio, com backfill do escritório atual, índice `(org_id, ...)` nas colunas mais consultadas e `default current_org_id()` nas inserções.
- `handle_new_user` deixa de inserir em `user_roles`; papel passa a vir de `organization_members` no aceite do convite.
- Armazenamento: caminhos `"{org_id}/..."` e políticas de bucket por membro do escritório; migração dos 16.271 arquivos existentes para o prefixo do escritório atual.
- Funções de servidor: resolver `org_id` pelo JWT do chamador; webhooks resolvem pelo identificador da integração (instância WhatsApp, conta Asaas) e não pelo JWT.
- `pg_cron`: as 11 rotinas passam a iterar por escritório ativo.
- Frontend: `useAuth` expõe `orgId`; seletor de escritório; rota de "sem acesso"; `signInWithOAuth({ provider: 'google' })` em `src/pages/Auth.tsx`.

Nesta etapa nada foi alterado — apenas leitura.
