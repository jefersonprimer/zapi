CREATE TABLE blocks (
    blocker_id      UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    blocked_id      UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);
