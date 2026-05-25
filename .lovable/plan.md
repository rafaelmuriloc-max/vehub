# Integração Google Drive (conta única do escritório)

Conectar o Drive da conta Google do escritório e disponibilizar acesso completo (listar, baixar, upload, criar, mover, excluir) em duas frentes do sistema.

## 1. Conexão

- Linkar o connector **Google Drive** do Lovable ao projeto (uma conexão única, OAuth feito pelo admin do escritório). Os arquivos vistos serão sempre os daquela conta.
- Todas as chamadas passam pelo gateway `https://connector-gateway.lovable.dev/google_drive/drive/v3` via Edge Function (`drive-api`) que injeta `LOVABLE_API_KEY` + `GOOGLE_DRIVE_API_KEY`.
- Restringir uso da Edge Function a usuários autenticados (admin e employee).

## 2. Edge Function `drive-api`

Função única que faz proxy para o Drive, com ações:
- `list` — lista arquivos/pastas (parâmetros: `folderId`, `q`, `pageToken`, `pageSize`, `orderBy`).
- `get` — metadados de um arquivo.
- `download` — baixa conteúdo (`alt=media`) e devolve como stream ou base64.
- `upload` — multipart upload (`name`, `mimeType`, `parents`, conteúdo base64).
- `createFolder` — cria pasta.
- `move` — atualiza `parents` (addParents/removeParents).
- `rename` — `PATCH /files/{id}` com novo `name`.
- `delete` — `DELETE /files/{id}` (vai para lixeira do Drive).

Validação de input com Zod e retorno padronizado `{ ok, data, error }`.

## 3. Nova página `/drive`

Rota adicionada no `App.tsx` + item no `AppSidebar` (ícone HardDrive).

Layout:

```text
┌──────────────────────────────────────────────────┐
│ Breadcrumb: Meu Drive › Clientes › Empresa X    │
│ [Novo ▾] [Upload] [Buscar...........] [Atualizar]│
├──────────────────────────────────────────────────┤
│ Nome              │ Tipo │ Tamanho │ Modificado  │
│ 📁 Folha 2026     │ ...  │  —      │ 22/05/2026  │
│ 📄 contrato.pdf   │ PDF  │ 380 KB  │ 20/05/2026  │
│   ↳ [Abrir][Baixar][Mover][Renomear][Excluir]   │
└──────────────────────────────────────────────────┘
```

- Tabela com paginação (`pageToken`).
- Busca por nome (`q=name contains '...'`).
- Drag&drop de upload na área da tabela.
- Botão "Novo" → Pasta / Upload de arquivo.
- Preview inline para imagens/PDF abrindo em diálogo (`webViewLink` no iframe).
- Confirmação antes de excluir.
- Responsivo: em mobile, vira lista de cards (segue padrão `mem://style/responsiveness-standard`).

## 4. Picker reutilizável `<DrivePickerDialog>`

Componente em `src/components/drive/DrivePickerDialog.tsx`:
- Abre um diálogo com a mesma navegação por pastas e busca.
- Permite seleção única ou múltipla (prop `multiple`).
- Callback `onSelect(files: DriveFile[])` devolve `{ id, name, mimeType, size, webViewLink }`.

Integração inicial:
- **Chat (`ChatInput.tsx`)** — novo item no menu de anexos "Anexar do Google Drive". Os arquivos selecionados são baixados via Edge Function e enviados como mídia normal do chat (mantém o fluxo existente de WhatsApp/Storage).
- **Tarefas (`TaskEditDialog.tsx` / fluxo de upload de documentos da obrigação)** — botão "Anexar do Drive" ao lado do upload local. O arquivo é baixado pela Edge Function e salvo no bucket `documents` seguindo as convenções de path já usadas.

Os arquivos vindos do Drive viram cópias no Storage do Supabase (não link), garantindo que a obrigação/chat continue funcionando mesmo se o arquivo for movido/excluído no Drive.

## 5. Detalhes técnicos

- `drive-api` retorna binários como base64 para simplificar; frontend converte para `Blob` antes de enviar ao Storage.
- Limite prático de download: ~20 MB por arquivo (configurável). Acima disso, mostrar erro e sugerir baixar direto pelo Drive.
- Cache leve de `list` por `folderId` no React Query (5 min).
- Erros do gateway (401/403) → toast "Reconectar Google Drive" com link para Settings.
- Sem alterações de banco: nenhum schema novo necessário (arquivos importados reaproveitam a tabela `documents` existente).

## 6. Permissões

- Página `/drive`: liberada para admin e employee (mesma regra do restante do sistema).
- Picker: idem.
- Exclusão no Drive: restrita a admin (checagem no frontend + na Edge Function via `has_role`).

## Fora do escopo

- Drive por usuário ou por cliente (escolhido como "drive único do escritório").
- Sincronização automática Drive ↔ Storage.
- Edição inline de documentos Google (Docs/Sheets/Slides) — apenas listagem/download.
