-- Create notification_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE notification_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'invalid_token');
    END IF;
END$$;

-- Create device_tokens table
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL, -- 'android', 'ios', 'web'
    device_name VARCHAR(100),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Copy existing push tokens into device_tokens if push_tokens table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'push_tokens') THEN
        INSERT INTO device_tokens (user_id, token, platform)
        SELECT user_id, token, 'android' FROM push_tokens
        ON CONFLICT (token) DO NOTHING;
        
        DROP TABLE push_tokens;
    END IF;
END$$;

-- Create notification_queue table
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data_payload JSONB,
    status notification_status NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for pending notifications
CREATE INDEX IF NOT EXISTS idx_notif_queue_pending ON notification_queue(status, run_at) 
WHERE status = 'pending';

-- Add privacy setting to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_notification_preview BOOLEAN NOT NULL DEFAULT TRUE;
