-- Migration: Add order cancellations and refunds support
-- 1. Add order_accept_timeout_minutes to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS order_accept_timeout_minutes INT DEFAULT 10;

-- 2. Create order_cancellations table
CREATE TABLE IF NOT EXISTS order_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    cancelled_by VARCHAR(50) NOT NULL, -- CUSTOMER, STORE, SYSTEM
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_order ON order_cancellations(order_id);

-- 3. Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    provider_refund_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
