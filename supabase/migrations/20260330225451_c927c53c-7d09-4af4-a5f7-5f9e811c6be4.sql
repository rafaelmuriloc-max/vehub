ALTER TABLE document_types
  ADD COLUMN IF NOT EXISTS sample_file_url text,
  ADD COLUMN IF NOT EXISTS sample_file_name text,
  ADD COLUMN IF NOT EXISTS extraction_config jsonb DEFAULT '{}'::jsonb;