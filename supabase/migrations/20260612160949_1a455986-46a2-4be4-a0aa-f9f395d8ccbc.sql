
-- ====== ASAAS SETTINGS (singleton) ======
CREATE TABLE public.asaas_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  webhook_token uuid NOT NULL DEFAULT gen_random_uuid(),
  default_billing_type text NOT NULL DEFAULT 'UNDEFINED' CHECK (default_billing_type IN ('BOLETO','PIX','CREDIT_CARD','UNDEFINED')),
  default_due_days int NOT NULL DEFAULT 7,
  enabled boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_settings TO authenticated;
GRANT ALL ON public.asaas_settings TO service_role;
ALTER TABLE public.asaas_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asaas_settings read auth" ON public.asaas_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "asaas_settings admin write" ON public.asaas_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_asaas_settings_updated BEFORE UPDATE ON public.asaas_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.asaas_settings DEFAULT VALUES;

-- ====== BANK ACCOUNTS ======
CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  bank_name text,
  agency text,
  account_number text,
  account_type text NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking','savings','cash','asaas')),
  initial_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  color text DEFAULT '#0F172A',
  active boolean NOT NULL DEFAULT true,
  is_asaas boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_accounts read auth" ON public.bank_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_accounts admin write" ON public.bank_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== COST CENTERS ======
CREATE TABLE public.cost_centers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text,
  parent_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  color text DEFAULT '#E8710A',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cost_centers read auth" ON public.cost_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_centers admin write" ON public.cost_centers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_cost_centers_updated BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== RECURRING ENTRIES ======
CREATE TABLE public.recurring_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('receivable','payable')),
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','weekly','yearly')),
  day_of_month int DEFAULT 1,
  start_date date NOT NULL,
  end_date date,
  next_run_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_entries TO authenticated;
GRANT ALL ON public.recurring_entries TO service_role;
ALTER TABLE public.recurring_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recurring_entries read auth" ON public.recurring_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "recurring_entries admin write" ON public.recurring_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_recurring_entries_updated BEFORE UPDATE ON public.recurring_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== ASAAS CUSTOMERS MAP ======
CREATE TABLE public.asaas_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asaas_customer_id text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, environment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_customers TO authenticated;
GRANT ALL ON public.asaas_customers TO service_role;
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asaas_customers read auth" ON public.asaas_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "asaas_customers admin write" ON public.asaas_customers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_asaas_customers_updated BEFORE UPDATE ON public.asaas_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== ASAAS CHARGES ======
CREATE TABLE public.asaas_charges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  asaas_charge_id text NOT NULL UNIQUE,
  asaas_subscription_id text,
  billing_type text,
  status text,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  pix_copy_paste text,
  value numeric NOT NULL,
  due_date date,
  paid_at timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_charges TO authenticated;
GRANT ALL ON public.asaas_charges TO service_role;
ALTER TABLE public.asaas_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asaas_charges read auth" ON public.asaas_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "asaas_charges admin write" ON public.asaas_charges FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_asaas_charges_updated BEFORE UPDATE ON public.asaas_charges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== ASAAS SUBSCRIPTIONS ======
CREATE TABLE public.asaas_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  asaas_subscription_id text NOT NULL UNIQUE,
  value numeric NOT NULL,
  cycle text NOT NULL DEFAULT 'MONTHLY',
  billing_type text,
  next_due_date date,
  status text,
  description text,
  environment text NOT NULL DEFAULT 'sandbox',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asaas_subscriptions TO authenticated;
GRANT ALL ON public.asaas_subscriptions TO service_role;
ALTER TABLE public.asaas_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asaas_subs read auth" ON public.asaas_subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "asaas_subs admin write" ON public.asaas_subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_asaas_subs_updated BEFORE UPDATE ON public.asaas_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== ASAAS WEBHOOK EVENTS (log) ======
CREATE TABLE public.asaas_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asaas_webhook_events TO authenticated;
GRANT ALL ON public.asaas_webhook_events TO service_role;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asaas_events read admin" ON public.asaas_webhook_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ====== BILL PAYMENTS ======
CREATE TABLE public.bill_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  asaas_payment_id text,
  bar_code text,
  pix_qr_code text,
  description text,
  value numeric NOT NULL,
  due_date date,
  scheduled_date date,
  status text DEFAULT 'PENDING',
  environment text NOT NULL DEFAULT 'sandbox',
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_payments read auth" ON public.bill_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "bill_payments admin write" ON public.bill_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_bill_payments_updated BEFORE UPDATE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== ALTER EXISTING TABLES ======
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asaas_charge_id text;
CREATE INDEX IF NOT EXISTS idx_fe_asaas_charge ON public.financial_entries(asaas_charge_id);

ALTER TABLE public.financial_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL;
