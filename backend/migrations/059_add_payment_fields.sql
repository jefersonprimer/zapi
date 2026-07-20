-- Migration: Add payment fields to orders table
ALTER TABLE orders 
ADD COLUMN payment_method VARCHAR(50),
ADD COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
ADD COLUMN payment_details JSONB;
