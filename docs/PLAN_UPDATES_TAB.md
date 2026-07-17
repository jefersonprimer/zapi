# Plano Detalhado: Aba Atualizações (Updates Tab) — v3 (MVP Ready)

## Visão Geral

Criar a aba **Atualizações** completa no Zapi, com **Stories** e **Feed**. O sistema é **desacoplado** do serviço de mensagens existente — banco, endpoints, handlers e frontend são módulos novos e independentes.

### Versões

| Versão | Escopo |
|--------|--------|
| **v1 (MVP)** | Stories + Feed + Likes + Comentários + Seguir + Upload + Blocks + Mute + Reports + Hidden Posts |
| **v2** | Canais, publishers verificados, posts fixados, posts salvos |
| **v3** | Hashtags, menções, recomendações avançadas, score sofisticado, bots, comunidades, serviços do superapp |

### Princípios de design

- **Publisher** como entidade central: no MVP, publishers são `user`, `channel` ou `business`.
- **Visibilidade** embutida desde o início: contatos, seguidores, canal, público.
- **Attachments** como tabela própria: múltiplos arquivos por post, tipos extensíveis.
- **Tabelas separadas** para likes, comentários, votos e shares.
- **Score calculado on-demand**: atualizado quando recebe like/comentário/share, sem cron.
- **Stories nunca são deletados**: marcados como expirados (futuro: "Arquivo").
- **Publisher criado no handler de registro**: não trigger SQL.
- **Moderação desde o início**: blocks, mute, reports, hidden posts.

---

## Stack Atual

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Rust + Axum 0.7, PostgreSQL (sqlx 0.8), JWT auth |
| **Frontend** | Expo SDK 54, React Native 0.81.5, TypeScript, Expo Router v6 |
| **Upload** | Endpoint `POST /upload` já funcional (images/videos/audio/documents) |
| **UI** | Sem UI library — tudo `StyleSheet.create()` + `lucide-react-native` |
| **Estado** | React Context (auth/theme), Zustand (calls), SQLite (chat), `authFetch()` para API |
| **Padrão backend** | Handlers com SQL inline, módulo `notes/` como referência de organização |

---

## Estrutura da Aba (Layout Visual)

```
┌─────────────────────────────────────┐
│  Header: "Atualizações"             │
├─────────────────────────────────────┤
│  ┌──────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│  │  ➕  │ │  👤 │ │  👤 │ │ 🏪  │ │
│  │ Meu  │ │Ana  │ │João │ │Loja │ │
│  │ Story│ │     │ │  🔵 │ │ 🔵  │ │
│  └──────┘ └─────┘ └─────┘ └─────┘ │
│  ← Stories (FlatList horizontal) →  │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ [Avatar] Ana · 2h atrás     │   │
│  │ Texto do post...            │   │
│  │ [imagem]                    │   │
│  │ 👍 12  💬 3  ↗️ 1           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [Avatar] 🏪 Loja · 5h atrás│   │
│  │ Promoção especial...        │   │
│  │ 📊 Enquete: 72% / 28%       │   │
│  └─────────────────────────────┘   │
│  ← Feed (FlatList vertical) →      │
└─────────────────────────────────────┘
```

### Prioridade do Feed (ordem de exibição)

```
Stories
  ↓
Posts dos contatos
  ↓
Posts dos canais seguidos
  ↓
Posts das lojas seguidas
  ↓
Comunidades                      <!-- v2 -->
  ↓
Recomendados                     <!-- v3 -->
  ↓
Serviços do Superapp             <!-- v3 -->
```

---

## Parte 1: Backend — Novo módulo `updates/`

### 1.1 Schema Completo do Banco

<!-- ============================================================ -->
<!-- v1 — MVP                                                      -->
<!-- ============================================================ -->

#### Migration 027: `publishers` — v1

Tabela central que representa quem cria conteúdo. No MVP: `user`, `channel`, `business`.

```sql
CREATE TABLE publishers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL CHECK (type IN (
                        'user', 'channel', 'business'
                    )),
    ref_id          UUID NOT NULL,  -- FK lógica para users(id), etc.
    name            VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(type, ref_id)
);
CREATE INDEX idx_publishers_type ON publishers(type);
```

**Criação:** Quando um `user` se registra, o handler `auth::register` cria um publisher do tipo `'user'` automaticamente. Canais e lojas criam publishers quando são criados.

> **v2:** Adicionar tipos `community`, `bot`, `event` — basta um `ALTER TABLE` no CHECK.

#### Migration 028: `follows` — v1

Relacionamento de seguir entre publishers.

```sql
CREATE TABLE follows (
    follower_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    following_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX idx_follows_following ON follows(following_id);
```

#### Migration 029: `stories` — v1

Status temporários (24h). **Nunca deletados** — marcados como expirados.

```sql
CREATE TABLE stories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    content         TEXT,
    background_color VARCHAR(7),
    font_color      VARCHAR(7),
    is_expired      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
CREATE INDEX idx_stories_publisher ON stories(publisher_id);
CREATE INDEX idx_stories_active ON stories(created_at DESC) WHERE is_expired = FALSE;
CREATE INDEX idx_stories_expires ON stories(expires_at) WHERE is_expired = FALSE;
```

#### Migration 030: `story_views` — v1

Quem já viu cada story.

```sql
CREATE TABLE story_views (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id    UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    viewer_id   UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_id, viewer_id)
);
CREATE INDEX idx_story_views_story ON story_views(story_id);
```

#### Migration 031: `story_attachments` — v1

Anexos de stories (imagem, vídeo). Estrutura idêntica a `post_attachments` para consistência.

```sql
CREATE TABLE story_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id        UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN ('image', 'video', 'gif')),
    url             TEXT NOT NULL,
    mime_type       VARCHAR(100),
    width           INTEGER,
    height          INTEGER,
    duration        INTEGER,
    size            INTEGER,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_story_attachments_story ON story_attachments(story_id);
```

#### Migration 032: `posts` — v1

Posts do feed. Cada post pertence a um **publisher**.

```sql
CREATE TABLE posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN (
                        'text', 'image', 'video', 'poll', 'gif', 'link'
                    )),
    content         TEXT,
    visibility      VARCHAR(20) NOT NULL DEFAULT 'contacts' CHECK (visibility IN (
                        'contacts', 'followers', 'channel', 'public'
                    )),
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,  -- v2: usado por canais/lojas
    poll_expires_at TIMESTAMPTZ,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    comments_count  INTEGER NOT NULL DEFAULT 0,
    shares_count    INTEGER NOT NULL DEFAULT 0,
    score           FLOAT NOT NULL DEFAULT 0.0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_posts_publisher ON posts(publisher_id);
CREATE INDEX idx_posts_feed ON posts(score DESC, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_posts_created ON posts(created_at DESC) WHERE is_deleted = FALSE;
```

> **v2:** `visibility` ganha valor `community`. `is_pinned` passa a ser usado ativamente.

#### Migration 033: `attachments` — v1

Arquivos associados a posts (múltiplos por post, tipos extensíveis).

```sql
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN (
                        'image', 'video', 'audio', 'document', 'gif',
                        'location', 'sticker', 'poll_image'
                    )),
    url             TEXT NOT NULL,
    mime_type       VARCHAR(100),
    width           INTEGER,
    height          INTEGER,
    duration        INTEGER,
    size            INTEGER,
    sha256          VARCHAR(64),
    thumbnail_url   TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attachments_post ON attachments(post_id);
```

#### Migration 034: `poll_options` — v1

Opções de enquete separadas da tabela posts.

```sql
CREATE TABLE poll_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    votes_count INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_poll_options_post ON poll_options(post_id);
```

#### Migration 035: `poll_votes` — v1

Votos individuais em enquetes.

```sql
CREATE TABLE poll_votes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    option_id   UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    voter_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    voted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, voter_id)
);
CREATE INDEX idx_poll_votes_post ON poll_votes(post_id);
```

#### Migration 036: `post_likes` — v1

Curtidas em posts.

```sql
CREATE TABLE post_likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
```

#### Migration 037: `post_comments` — v1

Comentários em posts. Suporta respostas (comentário pai).

```sql
CREATE TABLE post_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_comments_post ON post_comments(post_id);
CREATE INDEX idx_comments_parent ON post_comments(parent_id) WHERE parent_id IS NOT NULL;
```

#### Migration 038: `post_shares` — v1

Registra para onde e como os posts foram compartilhados.

```sql
CREATE TABLE post_shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    share_target    VARCHAR(20) NOT NULL CHECK (share_target IN (
                        'conversation', 'group', 'copy_link', 'repost'
                    )),
    target_id       UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shares_post ON post_shares(post_id);
```

> **v2:** Adicionar `community` e `story` ao CHECK de `share_target`.

#### Migration 039: `blocks` — v1

Bloqueio de publishers. Publisher bloqueado não aparece no feed e não pode ver seus posts.

```sql
CREATE TABLE blocks (
    blocker_id      UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    blocked_id      UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);
```

#### Migration 040: `muted_publishers` — v1

Silenciar sem deixar de seguir. Posts do publisher silenciado não aparecem no feed.

```sql
CREATE TABLE muted_publishers (
    user_id         UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    muted_id        UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, muted_id)
);
```

#### Migration 041: `reports` — v1

Denúncias de posts ou comentários.

```sql
CREATE TABLE reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    source_type     VARCHAR(20) NOT NULL CHECK (source_type IN ('post', 'comment', 'story')),
    source_id       UUID NOT NULL,
    reason          VARCHAR(50) NOT NULL CHECK (reason IN (
                        'spam', 'nudity', 'violence', 'hate_speech',
                        'harassment', 'false_info', 'other'
                    )),
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'reviewed', 'resolved', 'dismissed'
                    )),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_status ON reports(status) WHERE status = 'pending';
CREATE INDEX idx_reports_source ON reports(source_type, source_id);
```

#### Migration 042: `hidden_posts` — v1

Posts que o usuário escolheu não ver ("Não tenho interesse").

```sql
CREATE TABLE hidden_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reason      VARCHAR(50),  -- "not_interested", "already_seen", etc.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);
CREATE INDEX idx_hidden_posts_user ON hidden_posts(user_id);
```

#### Migration 043: `saved_posts` — v1

Posts bookmarkados pelo usuário.

```sql
CREATE TABLE saved_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, post_id)
);
CREATE INDEX idx_saved_posts_user ON saved_posts(user_id);
```

<!-- ============================================================ -->
<!-- v2 — Próxima versão                                           -->
<!-- ============================================================ -->

<!-- Migration futura: adicionar tipos ao CHECK de publishers -->
<!-- 'community', 'bot', 'event' -->

<!-- Migration futura: adicionar 'community' ao CHECK de visibility -->

<!-- Migration futura: adicionar 'community', 'story' ao CHECK de share_target -->

<!-- ============================================================ -->
<!-- v3 — Roadmap                                                  -->
<!-- ============================================================ -->

<!--
Migration 0XX: hashtags
CREATE TABLE hashtags (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag     VARCHAR(100) UNIQUE NOT NULL,
    count   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

Migration 0XX: post_hashtags
CREATE TABLE post_hashtags (
    post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    hashtag_id  UUID NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, hashtag_id)
);

Migration 0XX: mentions
CREATE TABLE mentions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type     VARCHAR(20) NOT NULL CHECK (source_type IN ('post', 'comment')),
    source_id       UUID NOT NULL,
    mentioned_id    UUID NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-->

---

### 1.2 Visão geral das tabelas (v1 — MVP)

```
v1 (MVP — 14 tabelas):
  publishers            ← quem cria conteúdo (user, channel, business)
  follows               ← quem segue quem
  stories               ← status temporários (24h, expirados não deletados)
  story_views           ← quem viu cada story
  story_attachments     ← arquivos dos stories (imagem, vídeo)
  posts                 ← posts do feed (com visibility, score)
  attachments           ← arquivos dos posts (múltiplos, tipos extensíveis)
  poll_options          ← opções de enquete
  poll_votes            ← votos em enquetes
  post_likes            ← curtidas
  post_comments         ← comentários (com suporte a respostas)
  post_shares           ← compartilhamentos
  blocks                ← bloqueio de publishers
  muted_publishers      ← silenciar sem deixar de seguir
  reports               ← denúncias
  hidden_posts          ← posts escondidos ("não tenho interesse")
  saved_posts           ← posts bookmarkados

v2 (adicionar):
  + tipos community/bot/event no publishers
  + visibility community nos posts
  + is_pinned ativo

v3 (adicionar):
  + hashtags + post_hashtags
  + mentions
  + score avançado com ML/recomendação
```

---

### 1.3 Novo módulo: `backend/src/updates/`

```
backend/src/updates/
├── mod.rs          # pub mod handlers; pub mod models; pub mod routes;
├── routes.rs       # Router<AppState>
├── handlers.rs     # Lógica de negócio + queries SQL
├── models.rs       # Structs FromRow, request/response types
└── scoring.rs      # Cálculo de score on-demand
```

### 1.4 Models (`updates/models.rs`)

```rust
// === Publishers ===
pub struct Publisher {
    pub id: Uuid,
    pub r#type: String,     // "user", "channel", "business" (v1)
    pub ref_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

pub struct CreatePublisherRequest {
    pub r#type: String,
    pub ref_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

// === Stories ===
pub struct Story {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub content: Option<String>,
    pub background_color: Option<String>,
    pub font_color: Option<String>,
    pub is_expired: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

pub struct StoryWithPublisher {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub publisher_name: String,
    pub publisher_avatar: Option<String>,
    pub publisher_type: String,
    pub is_verified: bool,
    pub content: Option<String>,
    pub background_color: Option<String>,
    pub font_color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub viewed: bool,
    pub attachments: Vec<StoryAttachment>,
}

pub struct StoryAttachment {
    pub id: Uuid,
    pub url: String,
    pub r#type: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
}

pub struct CreateStoryRequest {
    pub content: Option<String>,
    pub background_color: Option<String>,
    pub font_color: Option<String>,
    pub attachments: Vec<AttachmentRequest>,
}

// === Posts ===
pub struct Post {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub r#type: String,
    pub content: Option<String>,
    pub visibility: String,
    pub is_pinned: bool,
    pub poll_expires_at: Option<DateTime<Utc>>,
    pub likes_count: i32,
    pub comments_count: i32,
    pub shares_count: i32,
    pub score: f64,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
}

pub struct PostWithDetails {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub publisher_name: String,
    pub publisher_avatar: Option<String>,
    pub publisher_type: String,
    pub is_verified: bool,
    pub r#type: String,
    pub content: Option<String>,
    pub visibility: String,
    pub is_pinned: bool,
    pub attachments: Vec<PostAttachment>,
    pub poll_options: Option<Vec<PollOptionResponse>>,
    pub poll_expires_at: Option<DateTime<Utc>>,
    pub likes_count: i32,
    pub comments_count: i32,
    pub shares_count: i32,
    pub created_at: DateTime<Utc>,
    pub liked_by_me: bool,
    pub saved_by_me: bool,
    pub voted_option: Option<String>,
}

pub struct PostAttachment {
    pub id: Uuid,
    pub r#type: String,
    pub url: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
    pub thumbnail_url: Option<String>,
    pub sort_order: i32,
}

pub struct CreatePostRequest {
    pub r#type: String,
    pub content: Option<String>,
    pub visibility: Option<String>,
    pub attachments: Vec<AttachmentRequest>,
    pub poll_options: Option<Vec<String>>,
    pub poll_duration_hours: Option<i32>,
}

pub struct AttachmentRequest {
    pub url: String,
    pub r#type: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
    pub size: Option<i32>,
    pub sha256: Option<String>,
}

// === Interactions ===
pub struct PollOptionResponse {
    pub id: String,
    pub label: String,
    pub votes_count: i32,
    pub percentage: f64,
}

pub struct CommentResponse {
    pub id: String,
    pub user_id: String,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub parent_id: Option<String>,
    pub content: String,
    pub likes_count: i32,
    pub liked_by_me: bool,
    pub created_at: String,
    pub replies: Vec<CommentResponse>,
}

pub struct CommentRequest {
    pub content: String,
    pub parent_id: Option<String>,
}

pub struct PollVoteRequest {
    pub option_id: String,
}

pub struct ShareRequest {
    pub share_target: String,
    pub target_id: Option<String>,
}
```

### 1.5 Rotas (`updates/routes.rs`)

```rust
Router::new()
    // === Publishers ===
    .route("/publishers", post(create_publisher))
    .route("/publishers/:id", get(get_publisher))

    // === Stories ===
    .route("/stories", get(list_stories).post(create_story))
    .route("/stories/:id", delete(expire_story))
    .route("/stories/:id/view", post(mark_story_viewed))
    .route("/stories/publisher/:publisher_id", get(get_publisher_stories))

    // === Posts (Feed) ===
    .route("/posts", get(list_feed).post(create_post))
    .route("/posts/:id", get(get_post).delete(delete_post))
    .route("/posts/:id/like", post(toggle_like))
    .route("/posts/:id/comment", get(list_comments).post(add_comment))
    .route("/posts/:id/comment/:comment_id", delete(delete_comment))
    .route("/posts/:id/share", post(share_post))
    .route("/posts/:id/vote", post(vote_poll))
    .route("/posts/:id/save", post(toggle_save))
    .route("/posts/:id/hide", post(hide_post))

    // === Saved Posts ===
    .route("/saved", get(list_saved_posts))

    // === Follow ===
    .route("/follow/:publisher_id", post(toggle_follow))
    .route("/following", get(list_following))
    .route("/followers", get(list_followers))

    // === Moderation ===
    .route("/blocks/:publisher_id", post(toggle_block))
    .route("/mutes/:publisher_id", post(toggle_mute))
    .route("/reports", post(create_report))

    // v2: .route("/hashtags/trending", ...)
    // v2: .route("/hashtags/:tag/posts", ...)
    // v3: .route("/mentions", ...)
```

### 1.6 Handlers principais (`updates/handlers.rs`)

| Handler | Método | Descrição | Tabela(s) |
|---------|--------|-----------|-----------|
| **Publishers** | | | |
| `create_publisher` | POST | Cria publisher (chamado no registro de user) | `publishers` |
| `get_publisher` | GET | Detalhes de um publisher | `publishers` |
| **Stories** | | | |
| `list_stories` | GET | Stories ativos dos contatos/seguidos | `stories`, `story_attachments`, `story_views`, `follows` |
| `create_story` | POST | Cria story com attachments | `stories`, `story_attachments` |
| `expire_story` | DELETE | Marca `is_expired = TRUE` | `stories` |
| `mark_story_viewed` | POST | Registra visualização | `story_views` |
| `get_publisher_stories` | GET | Stories de um publisher | `stories`, `story_attachments` |
| **Posts** | | | |
| `list_feed` | GET | Feed paginado com score | `posts`, `attachments`, `follows`, `blocks`, `muted_publishers`, `hidden_posts` |
| `create_post` | POST | Cria post com attachments | `posts`, `attachments`, `poll_options` |
| `get_post` | GET | Detalhe de um post | `posts`, `attachments`, `poll_options` |
| `delete_post` | DELETE | Marca `is_deleted = TRUE` | `posts` |
| **Interações** | | | |
| `toggle_like` | POST | Like/deslike (atualiza score) | `post_likes`, `posts` |
| `list_comments` | GET | Comentários threaded | `post_comments` |
| `add_comment` | POST | Adiciona comentário (atualiza score) | `post_comments`, `posts` |
| `delete_comment` | DELETE | Marca comentário como deletado | `post_comments` |
| `share_post` | POST | Registra compartilhamento (atualiza score) | `post_shares`, `posts` |
| `vote_poll` | POST | Registra voto | `poll_votes`, `poll_options` |
| `toggle_save` | POST | Salvar/remover dos saved | `saved_posts` |
| `hide_post` | POST | Esconder post do feed | `hidden_posts` |
| **Saved** | | | |
| `list_saved_posts` | GET | Lista posts salvos | `saved_posts`, `posts` |
| **Follow** | | | |
| `toggle_follow` | POST | Seguir/deixar de seguir | `follows` |
| `list_following` | GET | Publishers que sigo | `follows`, `publishers` |
| `list_followers` | GET | Publishers que me seguem | `follows`, `publishers` |
| **Moderation** | | | |
| `toggle_block` | POST | Bloquear/desbloquear publisher | `blocks` |
| `toggle_mute` | POST | Silenciar/dessilenciar publisher | `muted_publishers` |
| `create_report` | POST | Criar denúncia | `reports` |

### 1.7 Cálculo de Score do Feed (`updates/scoring.rs`)

Score calculado **on-demand**, não com cron. Atualizado quando o post recebe like, comentário ou share.

```rust
pub fn calculate_score(
    post_age_hours: f64,
    likes_count: i32,
    comments_count: i32,
    shares_count: i32,
    is_from_contact: bool,
    is_from_followed_channel: bool,
    is_from_followed_business: bool,
    is_pinned: bool,
) -> f64 {
    let mut score = 0.0;

    // Engagement
    score += likes_count as f64 * 1.0;
    score += comments_count as f64 * 2.0;
    score += shares_count as f64 * 3.0;

    // Proximidade
    if is_from_contact { score += 50.0; }
    if is_from_followed_channel { score += 30.0; }
    if is_from_followed_business { score += 20.0; }

    // Decay temporal (decai em 24h)
    let decay = (-post_age_hours / 24.0).exp();
    score *= decay;

    // Pinned sempre no topo
    if is_pinned { score += 10000.0; }

    score
}
```

**Quando atualizar o score:**
- Após `toggle_like` (se liked)
- Após `add_comment`
- Após `share_post`

**Query de feed:**
```sql
SELECT p.*, pub.name, pub.avatar_url, pub.type, pub.is_verified
FROM posts p
JOIN publishers pub ON p.publisher_id = pub.id
WHERE p.is_deleted = FALSE
  AND p.visibility IN ('public', 'followers')  -- ajustar conforme relationship
  AND p.publisher_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = $1)
  AND p.publisher_id NOT IN (SELECT muted_id FROM muted_publishers WHERE user_id = $1)
  AND p.id NOT IN (SELECT post_id FROM hidden_posts WHERE user_id = $1)
ORDER BY p.is_pinned DESC, p.score DESC, p.created_at DESC
LIMIT $2 OFFSET $3;
```

### 1.8 Registro no router principal

Em `backend/src/main.rs`:
```rust
pub mod updates;
```

Em `backend/src/routes.rs`:
```rust
use crate::updates;
// ...
.nest("/updates", updates::routes::router())
```

### 1.9 Tarefa de background (apenas 1)

Expirar stories — roda a cada 1 hora:
```sql
UPDATE stories SET is_expired = TRUE
WHERE expires_at < NOW() AND is_expired = FALSE;
```

Não há cron de score. Score é recalculado sob demanda.

---

## Parte 2: Frontend — Service, Hook e Componentes

### 2.1 Novo service: `mobile/services/updatesApi.ts`

```typescript
// === Publishers ===
createPublisher(token, data)       // POST /updates/publishers
getPublisher(token, id)            // GET /updates/publishers/:id

// === Stories ===
getStories(token)                  // GET /updates/stories
createStory(token, data)           // POST /updates/stories
deleteStory(token, storyId)        // DELETE /updates/stories/:id
markStoryViewed(token, id)         // POST /updates/stories/:id/view
getPublisherStories(token, pid)    // GET /updates/stories/publisher/:publisher_id

// === Posts ===
getFeed(token, page)               // GET /updates/posts?page=N&limit=20
createPost(token, data)            // POST /updates/posts
getPost(token, postId)             // GET /updates/posts/:id
deletePost(token, postId)          // DELETE /updates/posts/:id

// === Interactions ===
toggleLike(token, postId)          // POST /updates/posts/:id/like
getComments(token, postId, page)   // GET /updates/posts/:id/comment?page=N
addComment(token, postId, data)    // POST /updates/posts/:id/comment
deleteComment(token, postId, cid)  // DELETE /updates/posts/:id/comment/:comment_id
sharePost(token, postId, data)     // POST /updates/posts/:id/share
votePoll(token, postId, data)      // POST /updates/posts/:id/vote
toggleSave(token, postId)          // POST /updates/posts/:id/save
hidePost(token, postId)            // POST /updates/posts/:id/hide

// === Saved ===
getSavedPosts(token, page)         // GET /updates/saved?page=N

// === Follow ===
toggleFollow(token, publisherId)   // POST /updates/follow/:publisher_id
getFollowing(token)                // GET /updates/following
getFollowers(token)                // GET /updates/followers

// === Moderation ===
toggleBlock(token, publisherId)    // POST /updates/blocks/:publisher_id
toggleMute(token, publisherId)     // POST /updates/mutes/:publisher_id
createReport(token, data)          // POST /updates/reports
```

### 2.2 Interfaces TypeScript

```typescript
// === Publisher ===
interface Publisher {
  id: string;
  type: 'user' | 'channel' | 'business';  // v1
  ref_id: string;
  name: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

// === Stories ===
interface StoryAttachment {
  id: string;
  url: string;
  type: 'image' | 'video' | 'gif';
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

interface Story {
  id: string;
  publisher_id: string;
  publisher_name: string;
  publisher_avatar: string | null;
  publisher_type: string;
  is_verified: boolean;
  content: string | null;
  background_color: string | null;
  font_color: string | null;
  created_at: string;
  expires_at: string;
  viewed: boolean;
  attachments: StoryAttachment[];
}

interface StoryGroup {
  publisher_id: string;
  publisher_name: string;
  publisher_avatar: string | null;
  publisher_type: string;
  is_verified: boolean;
  stories: Story[];
  all_viewed: boolean;
}

// === Posts ===
interface PostAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'gif' | 'location' | 'sticker';
  url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnail_url: string | null;
  sort_order: number;
}

interface PollOption {
  id: string;
  label: string;
  votes_count: number;
  percentage: number;
}

interface FeedPost {
  id: string;
  publisher_id: string;
  publisher_name: string;
  publisher_avatar: string | null;
  publisher_type: string;
  is_verified: boolean;
  type: 'text' | 'image' | 'video' | 'poll' | 'gif' | 'link';
  content: string | null;
  visibility: 'contacts' | 'followers' | 'channel' | 'public';
  is_pinned: boolean;
  attachments: PostAttachment[];
  poll_options: PollOption[] | null;
  poll_expires_at: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  liked_by_me: boolean;
  saved_by_me: boolean;
  voted_option: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  parent_id: string | null;
  content: string;
  likes_count: number;
  liked_by_me: boolean;
  created_at: string;
  replies: Comment[];
}
```

### 2.3 Novo hook: `mobile/hooks/useUpdates.ts`

Responsabilidades:
- Buscar e agrupar stories (por publisher, com flag `all_viewed`)
- Buscar feed com paginação infinita (score-based)
- Pull-to-refresh
- Criar/deletar (expirar) stories
- Criar/deletar posts
- Like/deslike, comentar (threaded), compartilhar, votar, salvar, esconder
- Marcar story como visto
- Seguir/deixar de seguir publishers
- Bloquear/m silenciar publishers
- Denunciar posts/comentários
- Gerenciar estado loading/error/empty

### 2.4 Componentes a criar

| # | Componente | Arquivo | Responsabilidade |
|---|-----------|---------|-----------------|
| 1 | `StoryItem.tsx` | `components/StoryItem.tsx` | Círculo de story: avatar, borda gradiente, nome. |
| 2 | `MyStoryItem.tsx` | `components/MyStoryItem.tsx` | Círculo "+ Seu status". |
| 3 | `StoryBar.tsx` | `components/StoryBar.tsx` | FlatList horizontal de stories. |
| 4 | `FeedPost.tsx` | `components/FeedPost.tsx` | Card de post completo. |
| 5 | `PostHeader.tsx` | `components/PostHeader.tsx` | Avatar + nome + tempo + menu. |
| 6 | `PostActions.tsx` | `components/PostActions.tsx` | Like, comment, share, save. |
| 7 | `PollCard.tsx` | `components/PollCard.tsx` | Enquete com barras de progresso. |
| 8 | `AttachmentGrid.tsx` | `components/AttachmentGrid.tsx` | Grid de anexos (1, 2, 3+). |
| 9 | `PinnedPostBanner.tsx` | `components/PinnedPostBanner.tsx` | Banner "📌 Fixado" — v2. |
| 10 | `CommentsModal.tsx` | `components/CommentsModal.tsx` | Modal threaded + input. |
| 11 | `PostOptionsMenu.tsx` | `components/PostOptionsMenu.tsx` | Menu: denunciar, silenciar, esconder, copiar, salvar. |
| 12 | `StoryViewer.tsx` | `components/StoryViewer.tsx` | Tela cheia: progresso, navegação, follow. |
| 13 | `CreatePostScreen.tsx` | `app/create-post.tsx` | Tela de criação: texto, anexos, enquete, visibilidade. |
| 14 | `StoryViewerScreen.tsx` | `app/story-viewer.tsx` | Rota Stack para story viewer. |
| 15 | `SavedPostsScreen.tsx` | `app/saved-posts.tsx` | Posts salvos. |
| 16 | `PublisherProfileScreen.tsx` | `app/publisher-profile.tsx` | Perfil de publisher. |

### 2.5 Modificações em arquivos existentes

| Arquivo | Mudança |
|---------|---------|
| `app/(tabs)/updates.tsx` | **Reescrever** — StoryBar + FlatList de posts |
| `app/_layout.tsx` | Adicionar rotas: `story-viewer`, `create-post`, `saved-posts`, `publisher-profile` |
| `app/(tabs)/_layout.tsx` | Badge no ícone de Atualizações |
| `services/api.ts` | Sem mudanças — `uploadFile()` reutilizado |
| `backend/src/handlers/auth.rs` | Criar publisher do tipo `'user'` no registro |

---

## Parte 3: Fluxos de Uso

### 3.1 Ver Stories
1. Usuário abre aba Atualizações
2. `useUpdates` busca stories via `GET /updates/stories`
3. Backend retorna stories ativos dos contatos + seguidos
4. Agrupados por publisher → `StoryGroup[]`
5. Meu publisher aparece primeiro
6. Tocar → abre `StoryViewer` em tela cheia
7. Barra de progresso: 5s por story
8. Tocar direita → próximo; esquerdo → anterior
9. Ao ver → `POST /updates/stories/:id/view`
10. Após 24h: `is_expired = TRUE`

### 3.2 Criar Story
1. Tocar no círculo "Seu status (+)"
2. Abrir tela de criação
3. Texto (com cor de fundo) OU imagem/vídeo
4. Publicar → `uploadFile()` → `POST /updates/stories`
5. Story aparece na barra

### 3.3 Ver Feed
1. `FlatList` vertical abaixo dos stories
2. `GET /updates/posts?page=1&limit=20`
3. Feed ordenado: contatos → canais → lojas → score
4. Paginação infinita
5. Pull-to-refresh

### 3.4 Criar Post
1. Ícone "criar post" no topo
2. `CreatePostScreen`: texto + anexos + enquete + visibilidade
3. Publicar → `POST /updates/posts`

### 3.5 Interagir com Post
- **Like**: `POST /updates/posts/:id/like` → atualiza score
- **Comentar**: `CommentsModal` → threaded com respostas
- **Compartilhar**: modal com opções (conversa, grupo, copiar link, republicar)
- **Votar**: enquete → `POST /updates/posts/:id/vote`
- **Salvar**: `POST /updates/posts/:id/save`
- **Esconder**: `POST /updates/posts/:id/hide`
- **Denunciar**: `PostOptionsMenu` → `POST /updates/reports`

### 3.6 Seguir Publisher
1. Tocar no avatar/nome → `PublisherProfileScreen`
2. Botão "Seguir" → `POST /updates/follow/:publisher_id`
3. Posts desse publisher passam a aparecer no feed

### 3.7 Moderação
- **Bloquear**: publisher some do feed, não pode ver seus posts
- **Silenciar**: posts não aparecem no feed, mas continua seguindo
- **Denunciar**: envia report para moderação
- **Esconder**: post some do feed individualmente

---

## Parte 4: Estilo Visual

### Paleta (reutilizar `constants/theme.ts`)

| Elemento | Light | Dark |
|----------|-------|------|
| Background | `#FAFAFA` | `#121212` |
| Card/Surface | `#FFFFFF` | `#1E1E1E` |
| Text primário | `#111827` | `#F9FAFB` |
| Text secundário | `#6B7280` | `#9CA3AF` |
| Accent (borda story) | `#007AFF` | `#0A84FF` |
| Borda story vista | `#D1D5DB` | `#4B5563` |
| Like ativo | `#EF4444` | `#F87171` |
| Save ativo | `#F59E0B` | `#FBBF24` |
| Badge verificado | `#3B82F6` | `#60A5FA` |
| Pinned | `#8B5CF6` | `#A78BFA` |
| Badge | `#10B981` | `#10B981` |

### Dimensões

| Elemento | Tamanho |
|----------|---------|
| Círculo story | 68px, borda 3px |
| Avatar post | 40px |
| Avatar publisher | 48px (com borda verificada) |
| Imagem (1) | full, max-height 400px |
| Imagem (2) | 50% cada, gap 2px |
| Imagem (3+) | grid 2x2, gap 2px |
| Card post | padding 16px, border-radius 12px |
| Barra progresso story | 3px, 5s |
| Comentário reply | indentação 24px |

---

## Parte 5: Ordem de Implementação (v1 — MVP)

### Fase 1 — Backend: Migrations (16 tabelas)
| # | Tarefa | Arquivo |
|---|--------|---------|
| 1 | Migration 027: `publishers` | `backend/migrations/027_create_publishers.sql` |
| 2 | Migration 028: `follows` | `backend/migrations/028_create_follows.sql` |
| 3 | Migration 029: `stories` | `backend/migrations/029_create_stories.sql` |
| 4 | Migration 030: `story_views` | `backend/migrations/030_create_story_views.sql` |
| 5 | Migration 031: `story_attachments` | `backend/migrations/031_create_story_attachments.sql` |
| 6 | Migration 032: `posts` | `backend/migrations/032_create_posts.sql` |
| 7 | Migration 033: `attachments` | `backend/migrations/033_create_attachments.sql` |
| 8 | Migration 034: `poll_options` | `backend/migrations/034_create_poll_options.sql` |
| 9 | Migration 035: `poll_votes` | `backend/migrations/035_create_poll_votes.sql` |
| 10 | Migration 036: `post_likes` | `backend/migrations/036_create_post_likes.sql` |
| 11 | Migration 037: `post_comments` | `backend/migrations/037_create_post_comments.sql` |
| 12 | Migration 038: `post_shares` | `backend/migrations/038_create_post_shares.sql` |
| 13 | Migration 039: `blocks` | `backend/migrations/039_create_blocks.sql` |
| 14 | Migration 040: `muted_publishers` | `backend/migrations/040_create_muted_publishers.sql` |
| 15 | Migration 041: `reports` | `backend/migrations/041_create_reports.sql` |
| 16 | Migration 042: `hidden_posts` | `backend/migrations/042_create_hidden_posts.sql` |
| 17 | Migration 043: `saved_posts` | `backend/migrations/043_create_saved_posts.sql` |

### Fase 2 — Backend: Models + Handlers + Routes
| # | Tarefa | Arquivo |
|---|--------|---------|
| 18 | Models | `backend/src/updates/models.rs` |
| 19 | Scoring | `backend/src/updates/scoring.rs` |
| 20 | Handlers | `backend/src/updates/handlers.rs` |
| 21 | Routes | `backend/src/updates/routes.rs` |
| 22 | Mod + registro | `backend/src/updates/mod.rs`, `main.rs`, `routes.rs` |
| 23 | Background: expirar stories | `backend/src/updates/cleanup.rs` |
| 24 | Modificar `auth::register` | Criar publisher `'user'` no registro |

### Fase 3 — Frontend: Service + Types
| # | Tarefa | Arquivo |
|---|--------|---------|
| 25 | Interfaces e funções API | `mobile/services/updatesApi.ts` |

### Fase 4 — Frontend: Componentes base
| # | Tarefa | Arquivo |
|---|--------|---------|
| 26 | `StoryItem.tsx` | `mobile/components/StoryItem.tsx` |
| 27 | `MyStoryItem.tsx` | `mobile/components/MyStoryItem.tsx` |
| 28 | `StoryBar.tsx` | `mobile/components/StoryBar.tsx` |
| 29 | `PostHeader.tsx` | `mobile/components/PostHeader.tsx` |
| 30 | `PostActions.tsx` | `mobile/components/PostActions.tsx` |
| 31 | `PollCard.tsx` | `mobile/components/PollCard.tsx` |
| 32 | `AttachmentGrid.tsx` | `mobile/components/AttachmentGrid.tsx` |
| 33 | `FeedPost.tsx` | `mobile/components/FeedPost.tsx` |

### Fase 5 — Frontend: Hook + Tela principal
| # | Tarefa | Arquivo |
|---|--------|---------|
| 34 | `useUpdates.ts` | `mobile/hooks/useUpdates.ts` |
| 35 | Reescrever `updates.tsx` | `mobile/app/(tabs)/updates.tsx` |

### Fase 6 — Frontend: Telas secundárias
| # | Tarefa | Arquivo |
|---|--------|---------|
| 36 | `StoryViewer.tsx` (componente) | `mobile/components/StoryViewer.tsx` |
| 37 | `story-viewer.tsx` (rota) | `mobile/app/story-viewer.tsx` |
| 38 | `CreatePostScreen.tsx` | `mobile/app/create-post.tsx` |
| 39 | `CommentsModal.tsx` | `mobile/components/CommentsModal.tsx` |
| 40 | `PostOptionsMenu.tsx` | `mobile/components/PostOptionsMenu.tsx` |
| 41 | `SavedPostsScreen.tsx` | `mobile/app/saved-posts.tsx` |
| 42 | `PublisherProfileScreen.tsx` | `mobile/app/publisher-profile.tsx` |
| 43 | Atualizar `_layout.tsx` do Stack | `mobile/app/_layout.tsx` |

### Fase 7 — Polish
| # | Tarefa |
|---|--------|
| 44 | Badge no ícone da aba |
| 45 | Empty states |
| 46 | Loading skeletons |
| 47 | Error handling e retry |
| 48 | Testes manuais ponta a ponta |

---

## Roadmap de Versões

### v1 (MVP) — 48 tarefas
- 17 migrations (17 tabelas)
- Stories + Feed + Likes + Comentários + Seguir
- Blocks + Mute + Reports + Hidden Posts + Saved Posts
- Upload de mídia (reutiliza `/upload` existente)
- Publisher: user, channel, business

### v2 — Features incrementais
- Publishers: adicionar `community`, `bot`, `event`
- `is_pinned` ativo (posts fixados por canais/lojas)
- `visibility: community`
- Compartilhamento para comunidades e stories
- `PinnedPostBanner` componente

### v3 — Avançado
- Hashtags + post_hashtags + trending
- Menções @ + autocomplete + notificações
- Score avançado com ML/recomendação
- Comunidades como publishers
- Serviços do superapp no feed
- Bots como publishers
