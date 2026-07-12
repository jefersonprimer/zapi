-- Add last_delivered_at column to chat_participants to track message delivery confirmation
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS last_delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
