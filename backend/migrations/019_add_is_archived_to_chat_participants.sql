-- Add is_archived to chat_participants
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add keep_chats_archived to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS keep_chats_archived BOOLEAN NOT NULL DEFAULT FALSE;
