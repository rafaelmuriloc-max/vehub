## Reenviar somente a mensagem da obrigação que falhou

### 1. `supabase/functions/pgdasd-sem-movimento/index.ts`
Adicionar suporte ao parâmetro `notify_only: true` no body. Quando presente:
- Pular completamente a chamada ao `integra-contador` e o `update` em `obligation_instances` (declaração já foi enviada).
- Apenas carregar `client`, `obligation`, calcular `mesAno`, resolver o telefone do Depto Fiscal e enviar via Evolution.
- Retornar `{ success, whatsapp_sent, whatsapp_error }`.

### 2. Disparar o reenvio
Invocar o edge function via `supabase--curl_edge_functions` com:
```json
{ "instance_id": "00723bef-89c1-4aa7-bfb7-56fe6800682a", "notify_only": true }
```
e conferir nos logs/resposta se `whatsapp_sent = true`.

Sem mudanças de UI ou schema. O modo `notify_only` também fica disponível para reenvios futuros caso outra mensagem falhe.
