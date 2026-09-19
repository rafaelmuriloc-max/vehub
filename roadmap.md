# Roadmap

- [x] Mover filtros da lista de NFS-e para abaixo do card de consulta
- [x] Selecionar o mês atual por padrão no filtro de período
- [x] Evitar erro 503 no download de NFS-e com PDF-espelho baseado no XML oficial
- [x] Recriar o cabeçalho do calendário conforme a referência, com quatro cards, desempenho e exportação
- [x] Reproduzir toda a área superior do calendário conforme a nova referência, incluindo busca, indicadores, desempenho por departamento e filtros
- [x] Deixar o medidor de desempenho geral igual à imagem: arco mais largo, ponteiro curto e número dentro do gráfico
- [x] Aumentar a fonte do título "Desempenho geral da operação" no card principal
- [x] Diagnóstico somente leitura do banco externo (autenticação, RLS, storage, cron, integrações)
- [x] Migrações versionadas de multi-tenant (001–007 + rollback) em supabase/multitenant, não aplicadas
- [x] Helpers de organização no frontend e em edge functions, desligados por flag
- [x] Testes de isolamento (SQL) e testes unitários de caminhos/convites
- [x] Login sem opção de criar conta; usuários pré-cadastrados recebem e-mail + senha temporária por WhatsApp, com troca obrigatória no primeiro acesso (campo must_change_password, action send-access, tela /change-password)
- [x] Redesenhar a Situação Fiscal com cards expansíveis, dados estruturados, filtros e relatório original rastreável
- [x] Monitoramento de pasta do Google Drive (raiz + subpastas) a cada 10 min importando para Documentos; tabelas drive_sync_configs/drive_synced_files, função drive-folder-sync publicada, job drive-folder-sync-10min, aba Drive em Configurações (admin)
- [ ] Configurar a primeira pasta monitorada em Configurações > Drive e validar a importação de um arquivo de teste

- [ ] Executar as migrações e os testes de isolamento em staging
- [ ] Migrar as 64 edge functions e os 11 jobs de cron para operar por organização
- [ ] Validação de assinatura e resolução de organização nos webhooks
- [ ] Telas por organização (seletor de escritório, rota sem acesso, convites)
- [ ] Configurar o provider Google e ligar as flags
