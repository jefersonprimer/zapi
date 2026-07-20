-- Migration: Add msg_type to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS msg_type VARCHAR(50) DEFAULT 'TEXT';
