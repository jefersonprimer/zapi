CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    source_type     VARCHAR(20) NOT NULL CHECK (source_type IN ('post', 'comment', 'story')),
    source_id       UUID NOT NULL,
    reason          VARCHAR(50) NOT NULL CHECK (reason IN ('spam', 'nudity', 'violence', 'hate_speech', 'harassment', 'false_info', 'other')),
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_status ON reports(status) WHERE status = 'pending';
CREATE INDEX idx_reports_source ON reports(source_type, source_id);
