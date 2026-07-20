-- Migration: Refactor delivery marketplace architecture to v2
-- 1. Set default status of orders to 'PENDING'
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'PENDING';

-- 2. Enhance payment_events to store provider, payload, and processed_at timestamp
ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'MOCK';
ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create payment_splits table
CREATE TABLE IF NOT EXISTS payment_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    recipient_type VARCHAR(50) NOT NULL, -- SELLER, PLATFORM, COURIER
    recipient_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    percentage DECIMAL(5,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, RELEASED, REFUNDED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_splits_transaction ON payment_splits(payment_transaction_id);

-- 4. Create deliveries table skeleton
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ASSIGNED, PICKED_UP, DELIVERED, CANCELLED
    pickup_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
