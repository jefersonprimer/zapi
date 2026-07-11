-- Add is_blocked field to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;
