-- Add privacy settings columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_messages VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (privacy_messages IN ('all', 'contacts', 'nobody'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_calls VARCHAR(20) NOT NULL DEFAULT 'contacts' CHECK (privacy_calls IN ('all', 'contacts', 'nobody'));
