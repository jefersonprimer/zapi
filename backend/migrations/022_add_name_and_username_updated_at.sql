-- Add name and username_updated_at columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMPTZ;
