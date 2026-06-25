## Correção PIS/COFINS — enviar guias do PIS que faltaram

### Causa raiz
`src/pages/Documents.tsx` dispara a cadeia `auto_start` no upload do documento sem o anti-race que existe em `ClientObligationsTab.tsx`. Quando o COFINS (order 2) é subido antes do PIS (order 1) via página Documentos, a atividade "Envia Darf WhatsApp" roda imediatamente com apenas o COFINS anexado, marca-se `completed=true` e o PIS nunca é enviado mesmo após o upload chegar minutos depois.

### Passos
1. **`src/pages/Documents.tsx`** — no loop `for (let ai = actIdx + 1 …)` (linhas ~574-603):
   - Adicionar checagem `priorDocs`: buscar `obligation_activity_completions` da instância e, se algum doc com `order < nextAct.order` estiver sem `file_url`, `break`.
   - Pular (`continue`) a próxima atividade se já tiver marker `completed=true` com `file_url IS NULL`.

2. **Reset dos casos travados (competência 05/2026)** via `supabase--insert`:
   - Identificar instâncias da obrigação PIS/COFINS (`c6359c67-…`) em `reference_month='2026-05-01'` onde:
     - existe completion da atividade `8553779a-…` (DARF PIS) com `file_url` não nulo (PIS já anexado), e
     - NÃO existe `whatsapp_logs` com `status='sent'` e `media_filename ILIKE '%PIS%'` para a atividade `07869e4e-…` (Envia Darf WhatsApp).
   - Resetar o marker (`file_url IS NULL`) dessa atividade para `completed=false, completed_at=null, failure_reason='Reenvio: PIS faltante'` nessas instâncias. Isso permite reprocessar.

3. **Reenviar via `ReprocessChainDialog`** (já existe e reaproveita `sendActivityWhatsApp`, que deduplica pelos `whatsapp_logs.status='sent'`):
   - Como o dialog atual é específico de Simples Nacional, vou rodar o reenvio diretamente chamando `sendActivityWhatsApp` por meio de um pequeno script no console / utilitário ad-hoc. Alternativa mais limpa: adicionar um botão "Reprocessar fluxo" similar ao do Simples Nacional na lista de instâncias PIS/COFINS — porém isso é mudança maior; para esta correção pontual, basta:
     - Após o reset (passo 2), abrir cada instância em `ClientObligationsTab` e clicar manualmente em "concluir" novamente a DARF COFINS — o anti-race agora aprova (PIS já tem file_url) e a cadeia reenviará só o PIS (COFINS já tem log `sent` → deduplicado).
   - Para evitar trabalho manual em 5+ empresas, vou usar `curl` no `whatsapp-send` ou invocar uma pequena função one-off. **Decisão prática**: criar um trigger via `supabase--insert` que, além do reset, força um `update` em qualquer completion para acionar o `recalc_obligation_instance_status` e instruir o usuário a clicar em "Reprocessar" — OU adicionar um botão genérico de "Reenviar WhatsApp da atividade" no `ClientObligationsTab` (3-4 linhas). Vou pelo caminho do botão para garantir reenvio em 1 clique.

### Detalhes técnicos
- Tabela `whatsapp_logs`: a dedupe na `sendActivityWhatsApp` usa `instance_id + activity_id + status='sent'` e separa por `media_filename`. Como o log do COFINS já tem `status='sent'` com `media_filename='..._COFINS_...pdf'`, só o PIS será reenviado.
- Empresas afetadas confirmadas: GOLDEN GREN, LOTEAMENTO BELA VISTA, OCEAN SIGNATURE, FONTE DELLA VITA, POUSADA RECANTO DO COWBOY (instâncias `44ac9660`, `93d3ef02`, `d439093f`, `3f405282`, mais 1 a confirmar).

### Arquivos a alterar
- `src/pages/Documents.tsx` — adicionar anti-race + skip-completed.
- `src/components/ClientObligationsTab.tsx` — adicionar mini-botão "Reenviar WhatsApp" na linha da atividade `whatsapp` (ao lado do toggle de concluir), que chama `sendActivityWhatsApp` direto.
- `supabase--insert` ad-hoc — resetar markers de `07869e4e-…` para instâncias 05/2026 com PIS anexado mas sem log sent do PIS.
