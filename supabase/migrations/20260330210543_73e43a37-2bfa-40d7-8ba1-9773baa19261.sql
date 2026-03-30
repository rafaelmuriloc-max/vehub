ALTER TABLE obligation_activities
  ADD COLUMN email_department_id uuid REFERENCES departments(id),
  ADD COLUMN email_subject text,
  ADD COLUMN email_body text;