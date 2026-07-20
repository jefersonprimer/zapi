-- Delivery / pickup scheduling slots (vendor-configurable)
CREATE TABLE store_delivery_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    fee DOUBLE PRECISION NOT NULL DEFAULT 0,
    fulfillment_type TEXT NOT NULL DEFAULT 'ambos'
        CHECK (fulfillment_type IN ('entrega', 'retirada', 'ambos')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_delivery_slots_store ON store_delivery_slots(store_id);

ALTER TABLE stores
    ADD COLUMN accepts_delivery BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN accepts_pickup BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN schedule_days INTEGER NOT NULL DEFAULT 5;

ALTER TABLE orders
    ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'entrega'
        CHECK (fulfillment_type IN ('entrega', 'retirada')),
    ADD COLUMN scheduled_date DATE,
    ADD COLUMN slot_start TEXT,
    ADD COLUMN slot_end TEXT;

-- Seed default slots for existing stores
INSERT INTO store_delivery_slots (store_id, start_time, end_time, fee, fulfillment_type, sort_order)
SELECT s.id, v.start_time, v.end_time, v.fee, 'ambos', v.sort_order
FROM stores s
CROSS JOIN (
    VALUES
        ('08:00', '09:00', 10.0::double precision, 0),
        ('10:00', '11:00', 10.0::double precision, 1),
        ('11:00', '12:00', 10.0::double precision, 2),
        ('14:00', '15:00', 10.0::double precision, 3),
        ('15:00', '16:00', 10.0::double precision, 4),
        ('16:00', '17:00', 10.0::double precision, 5),
        ('17:00', '18:00', 10.0::double precision, 6)
) AS v(start_time, end_time, fee, sort_order);
