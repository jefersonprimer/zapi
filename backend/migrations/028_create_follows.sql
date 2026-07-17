CREATE TABLE follows (
    follower_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    following_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);
