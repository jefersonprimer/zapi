-- Migration: Refactor delivery and payment architecture
-- 1. Alter order status column to VARCHAR to support decoupled statuses
ALTER TABLE orders ALTER COLUMN status TYPE VARCHAR(50);
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'PENDING_PAYMENT';

-- 2. Add payment_account_id to stores
ALTER TABLE stores ADD COLUMN payment_account_id VARCHAR(255);

-- 3. Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider_payment_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- PENDING, AUTHORIZED, PAID, REFUNDED, FAILED
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions(provider_payment_id);

-- 4. Create payment_events table for idempotency
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
