-- Add notification muting settings to chat_participants
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS notification_muted_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS notification_muted_forever BOOLEAN NOT NULL DEFAULT FALSE;
