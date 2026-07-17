CREATE TABLE story_views (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id   UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, viewer_id)
);
CREATE INDEX idx_story_views_story ON story_views(story_id);
