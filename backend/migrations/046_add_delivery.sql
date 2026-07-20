CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar TEXT,
    phone VARCHAR(20),
    pix_key VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'restaurante', 'padaria', 'mercado', 'farmacia',
        'fast_food', 'lanchonete', 'confeitaria', 'acougue',
        'bebidas', 'outro'
    )),
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    minimum_order DECIMAL(10,2) DEFAULT 0.00,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_city ON stores(state, city);
CREATE INDEX idx_stores_category ON stores(category);

CREATE TABLE store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_store_products_store ON store_products(store_id);

CREATE TYPE order_status AS ENUM (
    'pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    status order_status NOT NULL DEFAULT 'pendente',
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    observation TEXT,
    address_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_store ON orders(store_id);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store_products(id),
    product_name VARCHAR(255) NOT NULL,
    product_image TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    observation TEXT
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
