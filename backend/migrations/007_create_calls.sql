CREATE TABLE IF NOT EXISTS call_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    callee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL, -- 'completed', 'missed', 'rejected', 'failed', 'busy'
    duration    INTEGER NOT NULL DEFAULT 0, -- in seconds
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
