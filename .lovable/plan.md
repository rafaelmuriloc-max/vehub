## Visão geral
Expandir a aba Financeiro para um sistema completo com integração Asaas (sandbox/produção), além de novos módulos: contas bancárias, DRE, lançamentos recorrentes, e categorias/centros de custo avançados. Configuração da integração ficará em uma nova aba "Integrações" dentro de Financeiro.

## Estrutura final da página `/` (Financeiro)
Tabs:
1. **Visão Geral** (KPIs + gráficos atuais)
2. **Lançamentos** (CRUD existente, expandido)
3. **Recorrências** (novo)
4. **Contas Bancárias** (novo)
5. **Cobranças Asaas** (novo)
6. **DRE / Relatórios** (novo)
7. **Integrações** (novo — config Asaas + webhook URL)

## Banco de dados (migrações)

**Novas tabelas (public, com GRANTs + RLS admin-only para escrita, authenticated para leitura):**

- `asaas_settings` — singleton (1 linha)
  - `id`, `environment` ('sandbox'|'production'), `webhook_token` (uuid), `default_billing_type` ('BOLETO'|'PIX'|'CREDIT_CARD'|'UNDEFINED'), `default_due_days` (int), `enabled` (bool), `last_sync_at`, `created_at`, `updated_at`
  - A **API key** vai como secret (`ASAAS_API_KEY_SANDBOX` e `ASAAS_API_KEY_PROD`), não no banco.

- `bank_accounts` — `id`, `name`, `bank_name`, `agency`, `account_number`, `account_type` ('checking'|'savings'|'cash'|'asaas'), `initial_balance` (numeric), `current_balance` (numeric, calculada via trigger), `color`, `active`, `is_asaas` (bool), timestamps

- `cost_centers` — `id`, `name`, `code`, `parent_id` (auto-ref), `active`, `color`, timestamps

- `recurring_entries` — `id`, `description`, `amount`, `type` ('receivable'|'payable'), `category_id`, `cost_center_id`, `client_id`, `bank_account_id`, `frequency` ('monthly'|'weekly'|'yearly'), `day_of_month` (int), `start_date`, `end_date`, `next_run_date`, `active`, `created_by`, timestamps

- `asaas_customers` — mapa `client_id` ↔ `asaas_customer_id`, `synced_at`

- `asaas_charges` — `id`, `entry_id` (FK financial_entries), `client_id`, `asaas_charge_id`, `asaas_subscription_id` (nullable), `billing_type`, `status`, `invoice_url`, `bank_slip_url`, `pix_qr_code`, `pix_copy_paste`, `value`, `due_date`, `paid_at`, `raw` (jsonb), timestamps

- `asaas_subscriptions` — `id`, `client_id`, `asaas_subscription_id`, `value`, `cycle`, `billing_type`, `next_due_date`, `status`, `description`, timestamps

- `asaas_webhook_events` — `id`, `event`, `payload` (jsonb), `processed`, `error`, `received_at` (log de auditoria)

- `bill_payments` (pagamento de boletos/PIX via Asaas Transfer/Bill) — `id`, `entry_id`, `asaas_payment_id`, `bar_code`, `pix_qr_code`, `value`, `due_date`, `scheduled_date`, `status`, `raw` (jsonb), timestamps

**Alterações em tabelas existentes:**
- `financial_entries`: add `cost_center_id` (uuid, FK), `bank_account_id` (uuid, FK), `recurring_id` (uuid, FK), `asaas_charge_id` (text, indexed)
- `financial_categories`: add `parent_id` (auto-ref) para categorias avançadas hierárquicas

## Edge Functions

Todas com CORS e validação Zod. Selecionam API key conforme `asaas_settings.environment`.

- `asaas-customer-sync` — cria/atualiza customer no Asaas a partir de `clients` (nome, CNPJ, email, telefone, endereço); grava em `asaas_customers`.
- `asaas-charge-create` — recebe `entry_id`; garante customer; cria cobrança (`POST /v3/payments`) com `billingType` (BOLETO/PIX/UNDEFINED); grava em `asaas_charges`; retorna URL do boleto e PIX copia-cola.
- `asaas-charge-cancel` — `DELETE /v3/payments/{id}`.
- `asaas-subscription-create` / `asaas-subscription-cancel` — `/v3/subscriptions`; espelha em `asaas_subscriptions`.
- `asaas-bill-pay` — paga boleto/PIX (Asaas Bill Payment `/v3/bill` ou PIX Transfer `/v3/transfers`); cria registro em `bill_payments` e marca `entry_id` como pago quando confirmado.
- `asaas-webhook` (`verify_jwt = false`) — endpoint público. Valida token via query/header `asaas-access-token` igual a `asaas_settings.webhook_token`. Trata eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`: atualiza `asaas_charges` e o `financial_entries` correspondente (status `paid`/`overdue`, `paid_date`).
- `asaas-balance-sync` — consulta saldo Asaas (`/v3/finance/balance`) e atualiza `bank_accounts` da conta Asaas.
- `recurring-entries-runner` (CRON diário) — gera `financial_entries` a partir de `recurring_entries` quando `next_run_date <= today`, avança `next_run_date`.

## Secrets necessários
- `ASAAS_API_KEY_SANDBOX`
- `ASAAS_API_KEY_PRODUCTION`

(Solicitados via `add_secret` após a aprovação do plano.)

## Frontend

Novos componentes em `src/components/financial/`:
- `IntegrationsTab.tsx` — form de config Asaas: switch sandbox/produção, status da API key (verde se secret existe), `default_billing_type`, `default_due_days`, switch `enabled`, e card mostrando a **URL do webhook** (`{SUPABASE_URL}/functions/v1/asaas-webhook?token={webhook_token}`) com botão copiar + botão "Gerar novo token". Botão "Testar conexão" chama edge function leve.
- `BankAccountsTab.tsx` — CRUD de contas, com cards mostrando saldo atual e botão "Sincronizar saldo Asaas" para contas `is_asaas`.
- `RecurringEntriesTab.tsx` — CRUD de recorrências.
- `CostCentersDialog.tsx` — gerenciamento (acessível também dentro do dialog de lançamento).
- `AsaasChargesTab.tsx` — lista de cobranças Asaas com filtros (status, cliente, período), ações: ver fatura, copiar PIX, cancelar, marcar como pago manual.
- `BillPaymentDialog.tsx` — colar código de barras/PIX em lançamento `payable`; chama `asaas-bill-pay`.
- `DreTab.tsx` — seletor de período + tabela DRE (Receitas por categoria, Despesas por categoria, Resultado) e gráfico mensal.

Atualizações em `Financial.tsx`:
- Reorganizar em 7 abas listadas acima (mantendo KPIs no topo).
- Dialog "Novo Lançamento" ganha: select de **Conta bancária**, **Centro de custo**, e (para `receivable`) botão "Gerar cobrança Asaas" pós-salvar.

## Critérios de aceitação
- Admin configura ambiente (sandbox/prod), salva e vê status conectado.
- URL de webhook visível e copiável; eventos Asaas atualizam lançamentos automaticamente.
- Criar cobrança a partir de lançamento gera boleto/PIX e mostra link.
- Assinatura mensal pode ser criada para cliente ativo.
- Pagamento de boleto/PIX a partir de lançamento `payable` chega ao Asaas.
- Recorrências geram lançamentos automaticamente via CRON diário.
- Contas bancárias e centros de custo funcionam no CRUD de lançamentos.
- DRE exibe resultado por período com receitas/despesas agrupadas por categoria.

## Fora do escopo
- Antecipação de recebíveis, split de pagamentos, cartão tokenizado, multi-empresa.
