DROP INDEX IF EXISTS public.idx_employee_documents_drive_file;
CREATE UNIQUE INDEX idx_employee_documents_file_employee ON public.employee_documents(drive_file_id, employee_id) WHERE employee_id IS NOT NULL;
CREATE UNIQUE INDEX idx_employee_documents_file_unassigned ON public.employee_documents(drive_file_id) WHERE employee_id IS NULL;