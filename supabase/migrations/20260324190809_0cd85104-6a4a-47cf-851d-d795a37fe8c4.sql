ALTER TABLE obligations
  ADD COLUMN due_day integer,
  ADD COLUMN target_day integer,
  ADD COLUMN alert_day integer;