## Plano: Excluir e Criar Nova Instância (Aba WhatsApp)

Adicionar duas ações administrativas na aba **Configurações → WhatsApp** para resolver casos em que a instância da Evolution fica corrompida (cenário atual de "Connection Closed" persistente).

### 1. Novas Edge Functions (admin-only via `has_role`)

- **`evolution-instance-delete`** → tenta `DELETE /instance/logout/{instance}` (best-effort) e depois `DELETE /instance/delete/{instance}`. Aceita 404 como sucesso (instância já não existe).
- **`evolution-instance-create`** → `POST /instance/create` com:
  ```json
  {
    "instanceName": "<EVOLUTION_INSTANCE_NAME>",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true,
    "webhook": {
      "url": "<SUPABASE_URL>/functions/v1/whatsapp-webhook",
      "events": ["MESSAGES_UPSERT","MESSAGES_UPDATE","CONNECTION_UPDATE","CONTACTS_UPDATE"]
    }
  }
  ```
  Reusa o `EVOLUTION_INSTANCE_NAME` já em secrets — todo o restante do sistema continua apontando para o mesmo nome.

Ambas com `verify_jwt = false` em `supabase/config.toml` (auth manual via JWT, igual às `evolution-*` existentes).

### 2. Ajuste em `evolution-connection-state`

Mapear 404 da Evolution para `{ ok: true, state: "close", notFound: true }` — hoje vira "Desconhecido" sem contexto. Permite que a UI mostre uma mensagem clara.

### 3. UI — `EvolutionConnectionCard.tsx`

Adicionar uma seção **"Zona de manutenção"** (separada por `<Separator />`) com:

- Botão **"Criar nova instância"** (ícone `Plus`) — habilitado quando `notFound` ou `state === 'close'`. Em sucesso, abre o `EvolutionQrDialog` automaticamente.
- Botão **"Excluir instância"** (variant destructive, ícone `Trash2`) — confirma com `confirm("Isso apaga a instância e a sessão atual. Você precisará escanear o QR Code novamente. Continuar?")`. Em sucesso, atualiza o status.

Quando `notFound` for true, mostrar texto explicativo: _"A instância não existe na Evolution API. Clique em 'Criar nova instância' para configurar."_

### Arquivos
- `supabase/functions/evolution-instance-delete/index.ts` (novo)
- `supabase/functions/evolution-instance-create/index.ts` (novo)
- `supabase/functions/evolution-connection-state/index.ts` (mapear 404)
- `supabase/config.toml` (verify_jwt para as 2 novas)
- `src/components/settings/EvolutionConnectionCard.tsx` (botões + estado notFound)

### Fora do escopo
- Configurar nome da instância pela UI (continua via secret).
- Editar webhook/events pela UI (fixos no create).
