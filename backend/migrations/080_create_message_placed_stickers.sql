-- 080_create_message_placed_stickers.sql
-- Tabela para guardar os stickers que foram colados em cima de mensagens no chat (drag and drop)

CREATE TABLE IF NOT EXISTS message_placed_stickers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sticker_url TEXT NOT NULL,
    x_offset REAL NOT NULL,
    y_offset REAL NOT NULL,
    scale_factor REAL NOT NULL DEFAULT 1.0,
    rotation REAL NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_placed_stickers_msg ON message_placed_stickers(message_id);
