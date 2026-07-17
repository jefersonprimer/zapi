CREATE TABLE stories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    content         TEXT,
    background_color VARCHAR(7),
    font_color      VARCHAR(7),
    is_expired      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX idx_stories_publisher ON stories(publisher_id);
CREATE INDEX idx_stories_active ON stories(created_at DESC) WHERE is_expired = FALSE;
CREATE INDEX idx_stories_expires ON stories(expires_at) WHERE is_expired = FALSE;
