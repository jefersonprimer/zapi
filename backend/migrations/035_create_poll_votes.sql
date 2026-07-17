CREATE TABLE poll_votes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    option_id   UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    voter_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, voter_id)
);
CREATE INDEX idx_poll_votes_post ON poll_votes(post_id);
