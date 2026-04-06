

# Enviar alerta de certificados para grupo de WhatsApp

## Como funciona
A Evolution API aceita envio para grupos usando o `remoteJid` do grupo (formato `120363xxxxx@g.us`). O mesmo endpoint `/message/sendText` funciona — basta trocar o campo `number` pelo ID do grupo.

## Alterações propostas

### 1. Novo campo na seção de certificados (Clients.tsx)
Adicionar um campo "Grupo WhatsApp" ao lado dos campos de responsável, com um botão para buscar os grupos disponíveis na instância Evolution API. O usuário seleciona o grupo desejado de uma lista.

### 2. Migração de banco
Adicionar coluna `cert_whatsapp_group_id` (text, nullable) em `company_settings` para armazenar o ID do grupo selecionado.

### 3. Edge Function para listar grupos
Criar `supabase/functions/evolution-list-groups/index.ts` que chama `GET ${EVOLUTION_API_URL}/group/fetchAllGroups/${EVOLUTION_INSTANCE_NAME}` e retorna a lista de grupos (id + nome).

### 4. Atualizar cert-expiry-alert
Na Edge Function `cert-expiry-alert`, verificar se `cert_whatsapp_group_id` está preenchido:
- Se sim, enviar para o grupo (usando o ID do grupo como `number`)
- Se não, enviar para o telefone do responsável (comportamento atual)
- Opcionalmente enviar para ambos se ambos estiverem configurados

### Estrutura na UI
```text
Responsável: [___Nome___]  Telefone: [___Tel___]  
Grupo WhatsApp: [___Selecionar grupo▼___] [🔄 Buscar grupos]  [Salvar]
```

## Arquivos
- Migração SQL — 1 coluna em `company_settings`
- `supabase/functions/evolution-list-groups/index.ts` — nova Edge Function
- `supabase/functions/cert-expiry-alert/index.ts` — lógica condicional grupo vs telefone
- `src/pages/Clients.tsx` — campo de seleção de grupo + botão buscar
- `supabase/config.toml` — registrar nova função

