## Objetivo

Permitir, no chat, anexar e enviar arquivos que já foram anexados a obrigações das empresas vinculadas ao contato da conversa, num fluxo de 3 passos: empresa → obrigação → arquivo.

## Fluxo de UX

No `ChatInput`, no popover do botão "+", adicionar nova opção **"Anexar de obrigação"** (ícone Paperclip/FolderOpen).

Ao clicar, abre um Dialog com 3 etapas (em forma de selects encadeados, no mesmo modal):

1. **Empresa** — combobox com as empresas vinculadas ao contato da conversa atual (mesmo conjunto usado em `companyNames` / `client_department_contacts` por telefone). Se a conversa for vinculada diretamente a um cliente, já vem pré-selecionada.
2. **Obrigação** — combobox com as instâncias de obrigação dessa empresa que possuem arquivos anexados (label: "Nome da obrigação — MM/AAAA"). Buscar de `obligation_instances` + `obligations` filtrando as que tenham documentos relacionados.
3. **Arquivo** — lista (checkbox/radio simples) dos arquivos disponíveis daquela obrigação, vindos de duas fontes:
   - `documents` onde `client_id = empresa` e `linked_obligation_id = obrigação`
   - `obligation_activity_completions.file_url` cujo `instance_id` é a instância selecionada

Botão "Enviar" envia o arquivo escolhido como mídia no chat.

## Envio

Reutilizar o pipeline existente de mídia:

- Detectar tipo pelo nome/MIME (image/video/audio/document).
- Para conversas WhatsApp: chamar `whatsapp-send-media` passando direto o `mediaUrl` público do arquivo (sem fazer re-upload no bucket `chat-media`), `fileName` original, `senderName` e `senderId`.
- Para conversas internas: inserir em `chat_messages` com `message_type = whatsapp_<tipo>` e `media_url` apontando para a URL existente.
- Atualizar `updated_at` da conversa.

Se o arquivo estiver no bucket privado `documents`, gerar uma signed URL antes do envio (validade ampla) para que o WhatsApp/preview consiga acessar.

## Arquivos a alterar

- `src/components/chat/ChatInput.tsx`
  - Nova prop opcional `onPickFromObligation?: () => void` e novo item no `attachOptions` ("Anexar de obrigação").

- `src/pages/Chat.tsx`
  - Estado para abrir o novo Dialog e para empresa/obrigação/arquivo selecionados.
  - Função `sendExistingMedia(url, fileName, type)` reutilizando a lógica de `sendMedia` sem o upload no `chat-media`.
  - Resolver as empresas do contato:
    - Se `activeConv.client_id`: usa esse cliente.
    - Senão, reutiliza a mesma lógica de `whatsapp_phone` → `client_department_contacts` para obter `client_id`(s).

- `src/components/chat/AttachFromObligationDialog.tsx` (novo)
  - 3 comboboxes encadeados + botão "Enviar".
  - Busca preguiçosa: empresas (props), obrigações ao escolher empresa, arquivos ao escolher obrigação.

## Detalhes técnicos

- Comboboxes via Popover + Command (padrão do projeto).
- Para gerar URL pública de arquivos no bucket `documents` (privado), usar `supabase.storage.from('documents').createSignedUrl(path, 60*60*24*7)`. Para itens já com URL pública (ex: `chat-media`), usar diretamente.
- Detecção de tipo por extensão: imagens (jpg/png/gif/webp), vídeo (mp4/mov), áudio (mp3/m4a/ogg/webm), demais → document.
- Manter a checagem de `isClosed` e `ensureAssignedToMe` antes do envio.

## Fora de escopo

- Múltiplos arquivos por envio (envio um a um).
- Edição/criação de obrigações ou documentos.
