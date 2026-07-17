CREATE TABLE post_shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    share_target    VARCHAR(20) NOT NULL CHECK (share_target IN ('conversation', 'group', 'copy_link', 'repost')),
    target_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shares_post ON post_shares(post_id);
