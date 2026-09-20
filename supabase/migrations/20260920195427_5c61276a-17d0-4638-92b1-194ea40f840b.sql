CREATE TABLE public.client_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  cpf text,
  position text,
  admission_date date,
  salary numeric(12,2),
  termination_date date,
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_employees_client ON public.client_employees(client_id);
CREATE UNIQUE INDEX idx_client_employees_cpf ON public.client_employees(client_id, cpf) WHERE cpf IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_employees TO authenticated;
GRANT ALL ON public.client_employees TO service_role;
ALTER TABLE public.client_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view employees" ON public.client_employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert employees" ON public.client_employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update employees" ON public.client_employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete employees" ON public.client_employees FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_client_employees_updated_at BEFORE UPDATE ON public.client_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.client_employees(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  drive_modified_time text,
  drive_path text,
  file_name text NOT NULL,
  storage_path text,
  doc_kind text,
  status text NOT NULL DEFAULT 'imported',
  error text,
  parsed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_employee_documents_drive_file ON public.employee_documents(drive_file_id);
CREATE INDEX idx_employee_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX idx_employee_documents_client ON public.employee_documents(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view employee documents" ON public.employee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert employee documents" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update employee documents" ON public.employee_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete employee documents" ON public.employee_documents FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_employee_documents_updated_at BEFORE UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id text NOT NULL,
  folder_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.employee_sync_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.employee_sync_config TO authenticated;
GRANT ALL ON public.employee_sync_config TO service_role;
ALTER TABLE public.employee_sync_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view employee sync config" ON public.employee_sync_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage employee sync config" ON public.employee_sync_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_employee_sync_config_updated_at BEFORE UPDATE ON public.employee_sync_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();