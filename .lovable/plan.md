## Resumo

Reprocessar as ~30 instâncias DAS — Simples Nacional (competência 05/2026, vencimento 06/2026) que ficaram com documento anexado mas fluxo automático interrompido, **enviando o DAS via WhatsApp apenas para clientes que não têm nenhum registro de mídia entregue** (dedupe por presença de qualquer `whatsapp_logs.media_filename` na instância) e fechando e-mail/marcadores faltantes. Em paralelo, corrigir o bug de cadeia em `ClientObligationsTab.tsx`.

## Passos

### 1. Edge function nova: `obligation-chain-reprocess`
Entrada: `{ obligation_id, reference_month }` (ou lista de `instance_ids`).
Para cada instância encontrada:
1. Lê todas as activities da obrigação (ordenadas).
2. Confirma que a atividade 1 (document) tem `file_url`.
3. Para cada atividade seguinte com `auto_start=true`:
   - Se já há completion `completed=true` → pula.
   - Se WhatsApp:
     - Verifica em `whatsapp_logs` se existe **qualquer** linha com `instance_id = X` e `media_filename IS NOT NULL` → se sim, **não reenvia documento**, apenas marca a atividade como concluída (marker `completed=true`).
     - Caso contrário, dispara `sendActivityWhatsApp` (template_only ou documents_only conforme posição).
   - Se Email: dispara `sendActivityEmail` se ainda não houver `email_logs` para essa instance/activity; senão, marca como concluída.
4. Recalcula status da `obligation_instance` (trigger já existe).

Retorna lista por empresa com: enviado, pulado-pois-já-entregue, erro.

### 2. UI: botão em `SimplesNacionalTab`
Botão "Reprocessar fluxo automático" (apenas admin) que abre dialog:
- Seletor de mês de competência (default 05/2026).
- Pré-visualização das instâncias afetadas.
- Botão "Executar" → invoca a edge function.
- Toast com resumo (X enviadas, Y puladas, Z falhas).

### 3. Correção do bug de cadeia
Em `ClientObligationsTab.tsx` (duas ocorrências, linhas ~230 e ~320):
- Substituir o `break;` seguido de código morto por: marcar a atividade WhatsApp sem template/body como concluída e **continuar** a cadeia ao invés de interromper.

### 4. Hardening em `sendActivityWhatsApp`
Passar `activity_id` no body do invoke a `whatsapp-send` para que o log inserido pelo edge function já fique reconciliável (evita o problema atual de logs com `activity_id NULL`). Não muda comportamento dos envios já feitos.

### 5. Validação
Após executar reprocessamento:
- Conferir contagem de `obligation_instances` com `status='done'` para o filtro.
- Spot-check em 3 instâncias: 4 completions `completed=true`, status final correto, sem documentos duplicados em `whatsapp_logs`.

## Fora do escopo
- Mudar estrutura/ordem das atividades da obrigação.
- Reenviar para quem já recebeu (decidido: pular se houver qualquer `media_filename` na instância).
- Aplicar o mesmo reprocessamento a outras obrigações além do DAS-SN nesta rodada (a function fica pronta para reuso).