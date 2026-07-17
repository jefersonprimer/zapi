CREATE TABLE poll_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_poll_options_post ON poll_options(post_id);
