CREATE TABLE muted_publishers (
    user_id         UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    muted_id        UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, muted_id)
);
