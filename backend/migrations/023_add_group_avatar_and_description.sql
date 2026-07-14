-- Add avatar_url and description to chats table for groups
ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE chats ADD COLUMN IF NOT EXISTS description TEXT;
