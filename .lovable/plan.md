# Migração do banco (Supabase externo) para o Lovable Cloud

## Resposta curta

Sim, é possível sem perder dados — mas **não existe migração automática**. Tudo será exportado de um lado e reconstruído do outro, em uma janela de corte combinada. O Supabase atual fica intacto durante todo o processo e serve de reversão.

## O que existe hoje (inventário confirmado)

- ~64 tabelas com RLS, 8 usuários, 65 funções de servidor, 11 jobs agendados
- 4 buckets de arquivos com ~16.300 arquivos
- ~27 segredos (Asaas, Evolution, SERPRO, WhatsApp/Meta, proxy NFe, notificações push)
- 2 gatilhos no banco e 2 telas que gravam a URL do projeto atual no código
- Integrações externas que apontam para este projeto: webhook da Evolution (WhatsApp), proxy Hostinger (NFe), SERPRO com certificado e-CPF, Asaas

## Fases da migração

### Fase A — Preparação (sem risco, nada muda em produção)
1. Remover referências fixas ao projeto atual e usar a configuração do ambiente:
   - `sendActivityEmail.ts` e `EmailComposeDialog.tsx` (pixel de rastreio de e-mail)
   - gatilhos `trg_notify_chat_message` e `trg_ticket_sync_on_conversation` (URL + chave fixas no banco)
   - comandos dos 11 jobs agendados
2. Gerar os exports: schema + dados do banco, usuários (com senhas criptografadas preservadas), lista completa dos arquivos dos 4 buckets.

### Fase B — Construção do ambiente novo (fora do ar: nada)
3. Habilitar o Lovable Cloud no projeto e recriar o schema (tabelas, tipos, funções, gatilhos, políticas de acesso).
4. Importar os dados preservando todos os IDs.
5. Recriar os 8 usuários com as mesmas senhas e e-mails confirmados — **as sessões ativas caem: todos refazem login uma vez**.
6. Subir os ~16.300 arquivos nos mesmos caminhos e recriar as regras de acesso aos buckets.
7. Publicar as 65 funções de servidor e recriar os 11 jobs apontando para o Cloud.
8. Habilitar o realtime nas tabelas do chat.

### Fase C — Corte (janela combinada, ex.: fim de semana)
9. Congelar o uso por 1–2h, exportar o delta (o que mudou desde a Fase B), importar no Cloud.
10. Apontar o aplicativo para o Cloud, validar login, WhatsApp, NFS-e, chat e jobs.
11. Atualizar as integrações externas: webhook da Evolution, URL do Asaas, proxy NFe e SERPRO seguem com credenciais próprias re-adicionadas ao Cloud.

### Fase D — Validação e reversão
12. Conferência linha a linha das contagens por tabela; teste de upload/download; uma semana com o Supabase antigo intacto como reversão (basta apontar o app de volta).

## Multi-tenant e Google
- Recomendo migrar **primeiro com o estado atual** (fidelidade total) e aplicar as migrações 001–007 de multi-tenant **depois**, como etapa separada e testada.
- O login Google continua atrás da flag, desligado.

## O que pode se perder se não cuidarmos (e como evitamos)

| Risco | Como evitamos |
|---|---|
| Sessões ativas | Inevitável: todos refazem login (senhas preservadas) |
| Segredos | Não consigo ler os valores guardados no Supabase atual — **você precisará re-informar** Asaas, Evolution, SERPRO, WhatsApp/Meta, VAPID e o token do proxy NFe |
| Certificado e-CPF (SERPRO) | Reenvio do arquivo .p12 + senha na configuração do Cloud |
| Downtime | Somente na janela de corte (1–2h, fora do horário comercial) |
| E-mails de autenticação | Reconfigurar SMTP/Lovable Email no novo ambiente |
| Webhooks externos | Atualizar a URL na Evolution e no Asaas após o corte |

## Custos e pendências suas
- O Cloud é cobrado por uso (com franquia mensal gratuita) em vez da assinatura atual do Supabase — comparar antes do corte.
- Providenciar: valores dos segredos, arquivo do certificado, janela de corte, e acessos aos painéis da Evolution e do Asaas para atualizar webhooks.

## Validação
- Comparação de contagens por tabela antes/depois
- Teste de login dos 8 usuários, envio/recebimento no chat, sincronização de notas, jobs agendados rodando
- Build limpo (`bunx tsgo --noEmit`) após a Fase A
