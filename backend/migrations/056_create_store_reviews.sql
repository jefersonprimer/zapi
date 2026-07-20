CREATE TABLE store_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 0 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, user_id)
);

CREATE INDEX idx_store_reviews_store ON store_reviews(store_id);

ALTER TABLE stores ADD COLUMN score DECIMAL(3, 2) DEFAULT 0.00;
ALTER TABLE stores ADD COLUMN ratings_count INT DEFAULT 0;
