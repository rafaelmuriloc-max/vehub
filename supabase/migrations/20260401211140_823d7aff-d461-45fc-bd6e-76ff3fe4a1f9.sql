ALTER TABLE obligations ADD COLUMN assignment_mode text NOT NULL DEFAULT 'manual';
ALTER TABLE obligations ADD COLUMN segment_filters jsonb DEFAULT '{}'::jsonb;