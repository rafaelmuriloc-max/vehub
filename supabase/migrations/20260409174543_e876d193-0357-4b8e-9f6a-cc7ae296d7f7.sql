ALTER TABLE obligations ADD COLUMN is_retention boolean NOT NULL DEFAULT false;
ALTER TABLE obligations ADD COLUMN retention_tax_type text;