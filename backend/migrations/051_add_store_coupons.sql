CREATE TABLE store_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DOUBLE PRECISION NOT NULL,
    min_order DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    product_id UUID REFERENCES store_products(id) ON DELETE SET NULL,
    category TEXT,
    applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'product', 'category')),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, code)
);

CREATE INDEX idx_store_coupons_store_id ON store_coupons(store_id);
