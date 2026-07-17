CREATE TABLE post_comment_likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id  UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment ON post_comment_likes(comment_id);
