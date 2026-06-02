## Objetivo

Adicionar dentro do sistema uma forma de reconectar a instância da Evolution API gerando um novo QR Code, sem precisar acessar o painel da Evolution externamente.

## Onde ficará

- Em **Configurações → Integrações** (ou aba dedicada "WhatsApp / Evolution"), criar um card **"Conexão WhatsApp (Evolution API)"** com:
  - Status atual da instância (`open`, `connecting`, `close`).
  - Número conectado (quando disponível).
  - Botão **"Gerar novo QR Code"**.
  - Botão **"Desconectar"** (logout da instância).
  - Botão **"Reiniciar instância"** (restart).
- Acesso restrito a **admins** (RBAC já existente).

## Fluxo do QR Code

1. Usuário clica em "Gerar novo QR Code".
2. Frontend chama edge function `evolution-connect`.
3. A função:
   - Consulta `GET /instance/connectionState/{instance}` para ver o estado.
   - Se já estiver `open`, retorna status conectado.
   - Caso contrário, chama `GET /instance/connect/{instance}` na Evolution API, que retorna `base64` do QR Code (e/ou `pairingCode`).
4. Frontend exibe o QR Code em um dialog e faz **polling a cada 3s** em `evolution-connection-state` até virar `open` (ou expirar em ~60s, oferecendo regenerar).
5. Quando conectar, atualiza o status no card e fecha o dialog com toast de sucesso.

## Edge functions novas

Todas usam os secrets já configurados: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`. Tratamento de erro no mesmo padrão dos demais (`200` com `{ ok:false, transient }` em falhas 5xx/Connection Closed).

- `evolution-connect` → `GET /instance/connect/{instance}` retorna `{ base64, pairingCode, code }`.
- `evolution-connection-state` → `GET /instance/connectionState/{instance}` retorna `{ state, wuid?, profileName? }`.
- `evolution-logout` → `DELETE /instance/logout/{instance}`.
- `evolution-restart` → `PUT /instance/restart/{instance}`.

## Frontend

- Novo componente `src/components/settings/EvolutionConnectionCard.tsx` com:
  - Badge de status colorido (verde `open`, amarelo `connecting`, vermelho `close`).
  - Ações com confirmação para "Desconectar" e "Reiniciar".
- Novo dialog `src/components/settings/EvolutionQrDialog.tsx`:
  - Mostra QR como `<img src={data:image/png;base64,...} />`.
  - Timer regressivo e botão "Gerar novo".
  - Polling do estado com `setInterval` limpo no unmount.
- Integrar o card em `src/pages/Settings.tsx` (aba existente de integrações; se não houver, criar aba "WhatsApp").

## Segurança

- Edge functions exigem JWT do usuário e validam role `admin` via `has_role` antes de executar ações destrutivas (logout/restart). Para `connect` e `connectionState` também restringir a admin.

## Validação

1. Abrir Configurações → WhatsApp, ver status atual.
2. Desconectar → status vira `close`.
3. Gerar QR Code → escanear no celular → status vira `open` e dialog fecha.
4. Logs das edge functions mostram chamadas sem 5xx persistente.

## Fora de escopo

- Trocar nome da instância ou criar múltiplas instâncias.
- Configurar webhooks da Evolution (já existem).
