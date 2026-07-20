-- Geo coordinates + full store address + prep time for delivery MVP

ALTER TABLE user_addresses
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION;

ALTER TABLE stores
    ADD COLUMN street VARCHAR(255),
    ADD COLUMN number VARCHAR(20),
    ADD COLUMN neighborhood VARCHAR(255),
    ADD COLUMN cep VARCHAR(10),
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION,
    ADD COLUMN prep_time_minutes INT NOT NULL DEFAULT 20;
