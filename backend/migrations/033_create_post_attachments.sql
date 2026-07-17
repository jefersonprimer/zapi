CREATE TABLE post_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN ('image', 'video', 'audio', 'document', 'gif', 'location', 'sticker', 'poll_image')),
    url             TEXT NOT NULL,
    mime_type       VARCHAR(100),
    width           INTEGER,
    height          INTEGER,
    duration        INTEGER,
    size            INTEGER,
    sha256          VARCHAR(64),
    thumbnail_url   TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_post_attachments_post ON post_attachments(post_id);
