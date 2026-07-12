-- Add cleared_at column to chat_participants to track when a participant cleared/deleted the chat locally
ALTER TABLE chat_participants ADD COLUMN cleared_at TIMESTAMPTZ DEFAULT NULL;
