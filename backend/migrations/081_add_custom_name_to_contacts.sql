-- Add custom_name field to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255);
