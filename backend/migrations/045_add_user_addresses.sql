CREATE TABLE user_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(20) NOT NULL CHECK (label IN ('casa', 'trabalho', 'outro')),
    estado VARCHAR(2) NOT NULL,
    cidade VARCHAR(255) NOT NULL,
    bairro VARCHAR(255) NOT NULL,
    cep VARCHAR(10) NOT NULL,
    rua VARCHAR(255) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    ponto_referencia TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_addresses_user ON user_addresses(user_id);
