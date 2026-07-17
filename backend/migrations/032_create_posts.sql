CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('text', 'image', 'video', 'poll', 'gif', 'link')),
    content         TEXT,
    visibility      VARCHAR(20) NOT NULL DEFAULT 'contacts' CHECK (visibility IN ('contacts', 'followers', 'channel', 'public')),
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    poll_expires_at TIMESTAMPTZ,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    comments_count  INTEGER NOT NULL DEFAULT 0,
    shares_count    INTEGER NOT NULL DEFAULT 0,
    score           DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_publisher ON posts(publisher_id);
CREATE INDEX idx_posts_feed ON posts(score DESC, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_posts_created ON posts(created_at DESC) WHERE is_deleted = FALSE;
