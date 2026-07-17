CREATE TABLE story_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id        UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN ('image', 'video', 'gif')),
    url             TEXT NOT NULL,
    mime_type       VARCHAR(100),
    width           INTEGER,
    height          INTEGER,
    duration        INTEGER,
    size            INTEGER,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_story_attachments_story ON story_attachments(story_id);
