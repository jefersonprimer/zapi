-- Drop NOT NULL constraint from content to allow tombstoning deleted messages
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;

-- Add soft-delete fields
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_everyone BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create optimized partial index for active messages
CREATE INDEX IF NOT EXISTS idx_messages_chat_created_active
ON messages(chat_id, created_at ASC)
WHERE deleted_for_everyone = FALSE;
