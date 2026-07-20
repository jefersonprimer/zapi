CREATE TABLE store_product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, name)
);

CREATE INDEX idx_store_product_categories_store ON store_product_categories(store_id);

ALTER TABLE store_products
    ADD COLUMN category_id UUID REFERENCES store_product_categories(id) ON DELETE SET NULL,
    ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'unit'
        CHECK (sale_type IN ('unit', 'weight'));

-- Migrate existing category text values into store_product_categories
INSERT INTO store_product_categories (store_id, name, sort_order)
SELECT DISTINCT ON (sp.store_id, sp.category)
    sp.store_id,
    sp.category,
    0
FROM store_products sp
WHERE sp.category IS NOT NULL AND TRIM(sp.category) <> ''
ORDER BY sp.store_id, sp.category
ON CONFLICT (store_id, name) DO NOTHING;

UPDATE store_products sp
SET category_id = c.id
FROM store_product_categories c
WHERE c.store_id = sp.store_id AND c.name = sp.category;

ALTER TABLE order_items
    ADD COLUMN sale_type TEXT NOT NULL DEFAULT 'unit'
        CHECK (sale_type IN ('unit', 'weight')),
    ADD COLUMN quantity_decimal DOUBLE PRECISION;
