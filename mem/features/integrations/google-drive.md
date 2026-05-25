---
name: Google Drive Integration
description: Acesso ao Drive da conta do escritório via connector Lovable + página /drive + picker reutilizável
type: feature
---
Connector Google Drive (gateway) com scope `https://www.googleapis.com/auth/drive`. Single connection do escritório (admin autentica uma vez; todos veem os mesmos arquivos).

Edge Function `drive-api` (proxy autenticado, exige Bearer JWT):
- Actions: list, get, download (retorna base64), upload (multipart base64), createFolder, rename, move, delete, breadcrumb.
- `delete` exige `has_role(admin)`.
- Gateway URLs: `https://connector-gateway.lovable.dev/google_drive/drive/v3` e `/upload/drive/v3`.

Frontend:
- `src/components/drive/DriveBrowser.tsx` — componente base (modos `manage` e `picker`).
- `src/components/drive/DrivePickerDialog.tsx` — diálogo de seleção (`onPick(files)`).
- `src/pages/Drive.tsx` — página em `/drive` (sidebar: ícone HardDrive).
- Helper `downloadDriveFile(fileId)` baixa via Edge Function e devolve `Blob`.

Integrações:
- ChatInput: opção "Google Drive" no menu de anexos → vira `pendingFile` e usa o fluxo normal de envio.
- TaskEditDialog: botão "Drive" ao lado de "Anexar" copia o arquivo para o bucket `documents` (mesma convenção de path).

Limitação prática: download/upload em base64 ≈ até ~15-20 MB por arquivo.