---
name: Drive Folder Sync
description: Monitoramento de pasta do Google Drive importando documentos para o Vehub a cada 10 min
type: feature
---
Pastas do Drive configuradas pelo admin em Configurações > Drive (DriveSyncTab.tsx) são monitoradas a cada 10 min (pg_cron `drive-folder-sync-10min` → edge function `drive-folder-sync`, auth via `x-cron-secret` igual ao padrão nfe-nfse-daily-sync).

- Tabelas: `drive_sync_configs` (folder_id, department_id, obligation_id, allowed_doc_type_ids, enabled) e `drive_synced_files` (dedupe por config+drive_file_id; status imported/pending_review/error/ignored).
- Raiz + subpastas (BFS recursivo), reimporta versões novas (compara modifiedTime), nunca exclui documentos do Vehub.
- Identificação do cliente: 1) CNPJ no nome do arquivo/pasta; 2) nome da subpasta vs razão social; 3) IA via `classify-document`. Sem cliente/tipo → `pending_review` (não importa).
- Upload no bucket `documents` em `${clientId}/${refMonth}/${docTypeId}/${sanitizeFileName(name)}` com upsert (mesma convenção do Documents.tsx).
- Limite: 20 MB/arquivo, 40 arquivos por execução. Drive nativo (Docs/Sheets) é ignorado.
- Não existe push/webhook do Drive via conector — polling é a única via.
