-- sqlx cannot decode Postgres NUMERIC into Rust f64; align money columns with FLOAT8.
ALTER TABLE stores
    ALTER COLUMN delivery_fee TYPE DOUBLE PRECISION USING delivery_fee::double precision,
    ALTER COLUMN minimum_order TYPE DOUBLE PRECISION USING minimum_order::double precision;

ALTER TABLE store_products
    ALTER COLUMN price TYPE DOUBLE PRECISION USING price::double precision;

ALTER TABLE orders
    ALTER COLUMN subtotal TYPE DOUBLE PRECISION USING subtotal::double precision,
    ALTER COLUMN delivery_fee TYPE DOUBLE PRECISION USING delivery_fee::double precision,
    ALTER COLUMN total TYPE DOUBLE PRECISION USING total::double precision;

ALTER TABLE order_items
    ALTER COLUMN unit_price TYPE DOUBLE PRECISION USING unit_price::double precision,
    ALTER COLUMN subtotal TYPE DOUBLE PRECISION USING subtotal::double precision;
