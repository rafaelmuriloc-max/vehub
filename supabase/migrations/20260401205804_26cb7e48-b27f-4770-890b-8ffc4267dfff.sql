ALTER TABLE obligations ADD COLUMN is_tax boolean NOT NULL DEFAULT false;
ALTER TABLE obligations ADD COLUMN tax_sphere text;