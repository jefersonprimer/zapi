-- Add channel_id column to notification_queue for Android notification channel routing
-- This allows different notification types (messages, calls) to use different channels
-- with appropriate importance levels and behaviors
ALTER TABLE notification_queue ADD COLUMN IF NOT EXISTS channel_id VARCHAR(50) NOT NULL DEFAULT 'messages';
