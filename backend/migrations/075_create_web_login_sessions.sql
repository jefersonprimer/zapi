-- Migration 075: Create web_login_sessions table
CREATE TABLE IF NOT EXISTS web_login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- 'waiting', 'approved', 'cancelled', 'expired', 'used'
    browser VARCHAR(50),
    platform VARCHAR(50),
    ip VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_login_sessions_code ON web_login_sessions(code);
CREATE INDEX IF NOT EXISTS idx_web_login_sessions_expires ON web_login_sessions(expires_at);
