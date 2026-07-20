-- sqlx cannot decode Postgres NUMERIC into Rust f64; align score column with FLOAT8.
ALTER TABLE stores
    ALTER COLUMN score TYPE DOUBLE PRECISION USING score::double precision;
