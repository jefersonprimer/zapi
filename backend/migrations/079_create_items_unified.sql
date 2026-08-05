-- 079_create_items_unified.sql
-- Núcleo Comum de Items (Notas, Lembretes e Eventos) para o Superapp

CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'note', 'reminder', 'event'
    title VARCHAR(255) NOT NULL,
    content TEXT,
    color VARCHAR(20),
    pinned BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    tags JSON DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS note_details (
    item_id VARCHAR(36) PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    note_type VARCHAR(20) DEFAULT 'text', -- 'text', 'checklist', 'drawing'
    checklist JSON DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS reminder_details (
    item_id VARCHAR(36) PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(10) DEFAULT 'none', -- 'none', 'low', 'medium', 'high'
    repeat_pattern VARCHAR(20) DEFAULT 'none',
    location_trigger JSON,
    notification_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS event_details (
    item_id VARCHAR(36) PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    participants JSON DEFAULT '[]',
    repeat_pattern VARCHAR(20) DEFAULT 'none',
    device_calendar_event_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_items_user_type ON items(user_id, type);
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted_at);
