-- Add is_favorite to chat_participants
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Create chat_lists table
CREATE TABLE IF NOT EXISTS chat_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(50),
    icon VARCHAR(50),
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create chat_list_items table
CREATE TABLE IF NOT EXISTS chat_list_items (
    list_id UUID NOT NULL REFERENCES chat_lists(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (list_id, chat_id)
);
