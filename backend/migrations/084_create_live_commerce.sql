-- Migration: 084_create_live_commerce.sql

-- Tabela Principal de Live Streams
CREATE TABLE live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    stream_key VARCHAR(100) NOT NULL UNIQUE,
    playback_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'live', 'ended', 'archived'
    viewer_count INT DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index para otimização de busca de lives ativas
CREATE INDEX idx_live_streams_status ON live_streams(status);

-- Tabela de Associação de Produtos à Live
CREATE TABLE live_stream_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    is_featured BOOLEAN DEFAULT FALSE,
    featured_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_live_stream_products_active ON live_stream_products(live_stream_id, is_featured);

-- Histórico de Chat e Reações na Live
CREATE TABLE live_stream_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
