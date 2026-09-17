# Próximo passo: validar o multi-tenant em staging

## Onde estamos
O incremento de multi-tenant está preparado e inerte: 7 migrações versionadas em `supabase/multitenant/`, helpers no frontend e nas edge functions desligados por flag, testes unitários passando. Nada foi aplicado ao banco de produção, nenhuma função foi publicada e o Google continua desligado.

## Próximo passo proposto — testar em staging antes de tocar na produção
O banco de produção é externo e eu só tenho leitura. Para validar com segurança, precisamos de um ambiente de teste (staging) com escrita:

1. **Criar o projeto staging**: um projeto Supabase novo (gratuito) no painel do proprietário, restaurando um backup/dump da produção nele.
2. **Aplicar as migrações em ordem**: 001 → 007 em staging, verificando cada etapa (backfill dos 8 usuários, isolamento das 56 tabelas, storage sem mover os 16 mil arquivos).
3. **Rodar os testes de isolamento** (`supabase/multitenant/tests/isolation_tests.sql`): duas organizações sem vazamento, membro removido perde acesso, sem elevação de privilégio, acesso direto por API/storage bloqueado entre escritórios.
4. **Apontar um preview do app para o staging** e validar as telas principais (calendário, tarefas, chat, financeiro) com os dados reais copiados.

## Depois do staging validado (etapas seguintes, não neste passo)
- Migrar as 64 edge functions e os 11 jobs de cron para operar por organização.
- Webhooks com validação própria e resolução inequívoca da organização.
- Telas por escritório (seletor, rota "sem acesso", convites).
- Só então: aplicar em produção na janela combinada, configurar o Google OAuth e ligar as flags.

## O que preciso de você agora
- **Decisão**: você cria o projeto staging no seu painel do Supabase (posso te orientar passo a passo), ou prefere que eu detalhe primeiro o roteiro completo de restauração do backup?
- Nenhum segredo, dado ou configuração de produção será alterado nesta etapa.
