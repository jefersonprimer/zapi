CREATE TABLE publishers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL CHECK (type IN ('user', 'channel', 'business')),
    ref_id          UUID NOT NULL,
    name            VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(type, ref_id)
);
CREATE INDEX idx_publishers_type ON publishers(type);
