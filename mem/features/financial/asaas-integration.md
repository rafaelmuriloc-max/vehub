---
name: Asaas Integration
description: Sistema financeiro completo com Asaas (cobranças, assinaturas, webhook, bill payment) e módulos auxiliares
type: feature
---
Aba **Financeiro** (`/`) com 9 sub-abas: Lançamentos, Recorrências, Contas Bancárias, Centros de Custo, Cobranças Asaas, DRE, Fluxo de Caixa, Visão Geral, Integrações.

**Tabelas:** `asaas_settings` (singleton), `bank_accounts`, `cost_centers`, `recurring_entries`, `asaas_customers`, `asaas_charges`, `asaas_subscriptions`, `asaas_webhook_events`, `bill_payments`. Em `financial_entries`: `cost_center_id`, `bank_account_id`, `recurring_id`, `asaas_charge_id`. Em `financial_categories`: `parent_id` (hierárquico).

**Secrets:** `ASAAS_API_KEY_SANDBOX`, `ASAAS_API_KEY_PRODUCTION`. Selecionados via `asaas_settings.environment`.

**Edge functions:**
- `asaas-customer-sync` — cria/atualiza customer
- `asaas-charge-create` — POST /payments + busca PIX QR
- `asaas-charge-cancel` — DELETE /payments/{id}
- `asaas-subscription-create` / `asaas-subscription-cancel` — /subscriptions
- `asaas-bill-pay` — paga boleto (/bill) ou PIX (/transfers)
- `asaas-webhook` (verify_jwt=false) — valida `?token=<webhook_token>`; atualiza `asaas_charges` + `financial_entries` (status paid/overdue)
- `asaas-test-connection` — GET /finance/balance
- `asaas-balance-sync` — atualiza saldo das contas `is_asaas=true`
- `recurring-entries-runner` — CRON diário 07:00 UTC; gera lançamentos quando `next_run_date <= today`

**URL Webhook Asaas:** `{SUPABASE_URL}/functions/v1/asaas-webhook?token={webhook_token}`.
Token regenerável na aba Integrações; expira o anterior.

Helper compartilhado: `supabase/functions/_shared/asaas.ts` (asaasFetch, getSettings, corsHeaders).

Eventos Asaas tratados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED.