-- Add about (status message / recado) column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS about TEXT;
