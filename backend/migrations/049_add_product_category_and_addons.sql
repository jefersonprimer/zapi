ALTER TABLE store_products ADD COLUMN category TEXT NOT NULL DEFAULT 'outro';

CREATE TABLE product_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_addons_product_id ON product_addons(product_id);
