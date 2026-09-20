# Página "Pessoal" — funcionários dos clientes

Nova página no menu para controlar os funcionários de cada empresa cliente, com cadastro manual e sincronização de uma pasta do Google Drive.

## Como vai funcionar

**Lista de empresas**
- Lista das empresas ativas com busca por nome/CNPJ e código SCI, no mesmo padrão visual das outras telas.
- Cada empresa mostra a quantidade de funcionários ativos.
- Ao clicar, a linha expande e mostra abaixo a relação de funcionários daquela empresa.

**Relação de funcionários**
- Colunas: nome, CPF, cargo, data de admissão, salário, situação (ativo/demitido) e data de demissão.
- Filtro rápido por situação (ativos / demitidos / todos).
- Botões para adicionar, editar e desligar funcionário manualmente.
- Cada funcionário mostra os documentos vinculados vindos do Drive, com link para abrir o arquivo.

**Sincronizar pasta**
- Botão "Sincronizar pasta" no topo da página abre o seletor de pastas do Google Drive (o mesmo já usado em Configurações > Drive).
- A pasta escolhida fica salva como a pasta oficial do Pessoal; dá para trocar depois.
- A sincronização percorre a pasta e as subpastas, identifica a empresa (CNPJ no nome do arquivo/pasta ou nome da subpasta igual à razão social) e o funcionário (CPF ou nome no arquivo).
- Dos documentos individuais o sistema lê nome, CPF, cargo, admissão e salário quando estiverem no arquivo; cria o funcionário se ainda não existir e complementa os dados que faltarem, sem sobrescrever o que foi editado à mão.
- Arquivo sem empresa ou funcionário reconhecido fica marcado como "aguardando revisão", listado na própria página, sem criar cadastro errado.
- Nada é apagado: arquivo removido do Drive não remove funcionário nem documento.
- Rodar a sincronização é manual pelo botão (mesma pasta pode ser sincronizada quantas vezes quiser). Se você quiser depois, dá para agendar automático a cada 10 minutos como já acontece com a pasta de documentos.

## Detalhes técnicos

- Migração: tabelas `client_employees` (client_id, full_name, cpf, position, admission_date, salary, termination_date, status) e `employee_documents` (employee_id, client_id, drive_file_id, file_name, storage_path, doc_kind, parsed_at); tabela `employee_sync_config` (folder_id, folder_name, enabled, last_synced_at). GRANTs + RLS: leitura/escrita para usuários autenticados com acesso ao departamento Pessoal; admin gerencia a pasta; robô via service role. Trigger de `updated_at`.
- Edge function `employee-folder-sync`: reaproveita o padrão de `drive-folder-sync` (gateway `google_drive`, BFS recursivo, dedupe por `drive_file_id`, comparação de `modifiedTime`, limite de 20 MB/arquivo). Extração de dados do documento via `classify-document`/IA com prompt específico de ficha de funcionário; arquivos salvos no bucket `documents` em `${clientId}/pessoal/${employeeId}/${sanitizeFileName(nome)}`.
- Frontend: `src/pages/Personnel.tsx` + rota `/personnel` em `App.tsx` e item no `AppSidebar`; componentes de linha expansível, tabela de funcionários, dialog de cadastro/edição e `DrivePickerDialog` já existente para escolher a pasta.
- Validação: `bunx tsgo --noEmit`, build limpo e teste da sincronização com uma pasta de exemplo (arquivo novo cria, arquivo repetido não duplica).
