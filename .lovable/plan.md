# Login com Google — sem cadastro aberto, entrada só por convite

## Escopo desta etapa
Implementar o login com Google agora, com ingresso apenas por convite verificado. O multi-tenant completo (isolamento de dados, storage, edge functions, cron) fica para depois, conforme combinado. A validação em staging também fica para depois.

## Segurança primeiro (por que a ordem importa)
Hoje qualquer cadastro novo no sistema de login recebe automaticamente papel de funcionário e enxergaria os dados dos 230 clientes. O login com Google só pode ser ligado DEPOIS de remover esse ingresso automático — exatamente o que a migração 006 já preparada faz.

## Mudanças no banco (subset mínimo, não é a migração completa)
Aplicar apenas o necessário para convites + fim do ingresso automático:

1. **001 (corrigida)** — cria organizações, membros, convites e funções auxiliares. Correção necessária: a linha da coluna gerada `email` em `organization_invites` é SQL inválido e a migração falha se aplicada como está — removê-la (a tabela usa `invited_email`).
2. **Vínculo dos 8 usuários atuais** (trecho de backfill da 003, sem tocar as 56 tabelas de negócio): cria o escritório a partir do registro atual, vincula os 8 usuários preservando admin/funcionário, adiciona `profiles.org_id` e copia os departamentos de cada perfil.
3. **006** — novo cadastro não recebe mais papel automático; criação e aceite de convite (token de uso único, expirável, só hash gravado; aceite exige sessão com e-mail verificado pelo provedor); remoção de membro apenas desativa o vínculo.
   - A ordem acima é obrigatória: o backfill precisa existir ANTES da 006, senão as regras de acesso existentes deixam de autorizar qualquer um.
   - Aplicação via ferramenta de migração com sua aprovação; se o banco externo recusar escrita, entrego o SQL para você rodar no SQL Editor do Supabase.
4. **Smoke test** após aplicar: conferir que `has_role` continua autorizando os 8 usuários e que um usuário sem organização não enxerga nada.

## Mudanças no app
- **Tela de login (`Auth.tsx`)**: remove a opção "Cadastre-se" (só e-mail/senha + Entrar com Google). O botão Google passa a ser controlado apenas por `VITE_ENABLE_GOOGLE_AUTH` (sem exigir o isolamento completo).
- **Página de callback `/auth/callback`**: recebe o retorno do Google, espera a sessão e redireciona.
- **Página de convite `/invite?token=...`**: se não estiver logado, vai para o login e volta; logado, chama `accept_org_invite` (uso único, expiração, e-mail do convite precisa bater com o da sessão), atualiza a organização e entra no sistema. Erros claros: expirado, já usado, outro e-mail.
- **Tela "Sem acesso"**: quem logar sem pertencer a um escritório vê uma página explicando que o acesso é por convite, com campo para colar o link/token do convite. Nada do sistema é exibido.
- **Convites no painel (Configurações → Usuários)**: administrador informa e-mail, papel e departamentos, recebe um link de convite de uso único para enviar (o token só é exibido uma vez).
- **Montagem**: `OrganizationProvider` passa a ser montado no app, com bloqueio de rotas para quem está sem organização (comportamento inerte enquanto as migrações não existirem).

## Configuração manual que só você pode fazer
1. **Google Cloud**: criar tela de consentimento publicada e credencial OAuth (tipo Web). Redirect URI: `https://ismgjjvarzzfsbdpthot.supabase.co/auth/v1/callback`. Origens autorizadas: `https://vehub.lovable.app` e a URL de preview.
2. **Painel Supabase**: Authentication → Providers → Google, colar ID e segredo; URL Configuration com Site URL `https://vehub.lovable.app` e redirect `.../auth/callback`; desativar "Allow new users to sign up" (o login por e-mail dos 8 usuários continua funcionando).

## O que fica de fora (para depois, como combinado)
- Isolamento de dados por escritório (002–005, 007), storage, 64 edge functions, cron e webhooks.
- Contas Google com o mesmo e-mail dos 8 usuários: continuam podendo usar e-mail/senha; o vínculo com Google segue fluxo oficial do Supabase, sem vínculo manual.

## Validação
- Typecheck, build e testes unitários de tenant passando.
- Fluxo testado: convite criado por admin → aceite por sessão verificada → acesso concedido; conta Google sem convite → tela "Sem acesso"; nada é exibido sem organização.
