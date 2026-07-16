CREATE TABLE pix_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pix_type VARCHAR(20) NOT NULL CHECK (pix_type IN ('celular', 'cpf', 'email', 'aleatoria')),
  pix_value VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'contatos' CHECK (visibility IN ('todos', 'contatos', 'ninguem')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
