CREATE TABLE post_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_post ON post_comments(post_id);
CREATE INDEX idx_comments_parent ON post_comments(parent_id) WHERE parent_id IS NOT NULL;
