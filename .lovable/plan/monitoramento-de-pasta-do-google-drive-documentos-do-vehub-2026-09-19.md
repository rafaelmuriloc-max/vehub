# Monitoramento de pasta do Google Drive → Documentos do Vehub

## Objetivo
Vigiar uma pasta do Google Drive (incluindo subpastas) a cada 10 minutos. Arquivos novos ou modificados são baixados, identificados pela IA (cliente, tipo, competência) e importados para os Documentos do Vehub — como a importação inteligente atual, mas automática.

## Regras confirmadas
- Destino: importar para **Documentos** (bucket `documents` + tabela `documents`)
- Abrangência: **pasta raiz + todas as subpastas** (nome da subpasta ajuda a vincular o cliente)
- Frequência: verificação **a cada 10 minutos**
- Arquivo alterado no Drive: **reimporta a versão nova** (atualiza o documento existente)
- Arquivo excluído no Drive: **nada é apagado** no Vehub

## O que será construído

### 1. Configuração (tela)
- Nova seção "Monitoramento do Drive" em **Configurações** (apenas admin):
  - Escolher a pasta raiz usando o seletor de pastas já existente (`DriveBrowser` em modo picker)
  - Definir contexto padrão: departamento, obrigação e tipos de documento permitidos (mesma lógica do `ImportSetupDialog`)
  - Liga/desliga do monitoramento
- Nova tabela `drive_sync_configs`: pasta, departamento, obrigação, tipos permitidos, ativo.

### 2. Rastreamento do que já foi importado
- Nova tabela `drive_synced_files`: ID do arquivo no Drive, data de modificação, documento criado no Vehub, status (importado, ignorado, erro, aguardando revisão).
- É ela que garante: nada duplicado, versão nova reimportada, exclusões ignoradas.

### 3. Robô de sincronização (Edge Function `drive-folder-sync`)
A cada execução:
1. Lista recursivamente a pasta configurada via conector do Google Drive (já existente)
2. Compara com `drive_synced_files` e separa: novos, modificados, sem alteração
3. Baixa os novos/modificados (limite prático ~15-20 MB por arquivo, igual ao Drive atual)
4. Identifica o cliente: primeiro pelo nome da subpasta/CNPJ no nome do arquivo; se não bastar, usa a IA já existente (`classify-document`) para extrair CNPJ, competência e tipo
5. Salva no bucket `documents` (mesmas regras de nome de arquivo do sistema) e cria/atualiza o registro em `documents`
6. Arquivos sem cliente identificado ficam marcados como "aguardando revisão" — nada é importado para o cliente errado
7. Execução protegida por segredo de cron (`x-cron-secret`), como os demais robôs do sistema

### 4. Agendamento
- Job a cada 10 minutos (pg_cron + pg_net), seguindo o padrão dos 11 jobs existentes.

### 5. Visibilidade
- Na seção de Configurações: histórico das últimas sincronizações (arquivos importados, erros, itens aguardando revisão) com botão "Sincronizar agora" para rodar manualmente.

## Fora de escopo
- Excluir documentos do Vehub quando apagados no Drive
- Notificações por WhatsApp (pode ser um passo futuro)
- Arquivos acima de ~20 MB (limitação do download via conector)

## Detalhes técnicos
- Reaproveita: `drive-api` (list/download), `classify-document` (IA), convenções de path do bucket `documents` (`mem://tech/storage-conventions`)
- Migração nova com GRANTs e RLS (`drive_sync_configs`, `drive_synced_files` — acesso admin; robô usa service role)
- Sem alteração nas telas de Documentos/Calendário: os arquivos importados aparecem naturalmente

## Validação
- Teste da Edge Function com pasta de exemplo
- Verificação de que arquivo modificado gera atualização (não duplicata)
- `bunx tsgo --noEmit` e build limpos
