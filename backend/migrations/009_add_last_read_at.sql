-- Add last_read_at to chat_participants to track unread messages
ALTER TABLE chat_participants ADD COLUMN last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
