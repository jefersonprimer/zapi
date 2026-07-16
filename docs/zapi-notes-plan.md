# Zapi Notes — Plano MVP

> **Princípio:** O Zapi Notes não pretende competir com o Notion. Ele é uma funcionalidade do Zapi para capturar e organizar notas rapidamente. Novos recursos serão adicionados apenas quando houver necessidade comprovada.

---

## O que é (V1)

Feature de notas dentro do superapp. Criar, editar, excluir, favoritar. Nada mais.

## O que NÃO é (V1)

Sem pastas, lixeira, anexos, cores, busca, tags, triggers, search vector, position.

---

## Backend

### Estrutura isolada

```
src/
  notes/
    mod.rs
    routes.rs
    models.rs
    handlers.rs
```

O `routes.rs` principal apenas:

```rust
.nest("/notes", notes::routes::router())
```

### Banco — Migração `025_create_notes.sql`

```sql
CREATE TABLE notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_user ON notes(user_id);
```

### API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/notes` | Listar notas do usuário |
| `POST` | `/notes` | Criar nota |
| `GET` | `/notes/:id` | Obter nota |
| `PATCH` | `/notes/:id` | Atualizar nota |
| `DELETE` | `/notes/:id` | Excluir nota |

### Arquivos

| Arquivo | Descrição |
|---|---|
| `backend/migrations/025_create_notes.sql` | Schema |
| `backend/src/notes/mod.rs` | Módulo |
| `backend/src/notes/models.rs` | Structs |
| `backend/src/notes/handlers.rs` | CRUD |
| `backend/src/notes/routes.rs` | Router |
| `backend/src/main.rs` | +`mod notes;` |
| `backend/src/routes.rs` | +`.nest("/notes", ...)` |

---

## UI (React Native)

### Tela 1: Lista de notas

- Header: "Notas"
- Botão "+" flutuante
- Lista: título + preview do conteúdo (2 linhas)
- Favorito aparece com ⭐
- Swipe ou long press para excluir
- Toque para editar

### Tela 2: Criar / Editar nota

- Input título
- Input conteúdo (multiline)
- Botão salvar (topo)
- Se editando: botão excluir

---

## V2 (futuro, quando necessário)

- Pastas
- Lixeira (soft delete)
- Busca full-text (tsvector + GIN)
- Anexos
- Cores
- Trigger updated_at
- Tags
