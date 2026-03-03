
ALTER TABLE public.clients
  ADD COLUMN opening_date date,
  ADD COLUMN from_another_office boolean NOT NULL DEFAULT false,
  ADD COLUMN previous_office_name text,
  ADD COLUMN exit_reason text,
  ADD COLUMN destination_office_name text,
  ADD COLUMN exit_reason_notes text;
