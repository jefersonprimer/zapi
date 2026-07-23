# Plano de Implementação: Feature Comunidades

## Visão Geral

Criar uma feature de **Comunidades** no Zapi, inspirada na simplicidade do WhatsApp com recursos do Discord/Telegram. A feature será implementada primeiro no **backend (Rust)** e **web (Next.js)**, sendo reutilizada posteriormente no **mobile (React Native)**.

---

## Estrutura de Dados

### Modelo Conceitual

```
Comunidade
├── Membros (owner, admin, moderador, membro)
├── Canais (avisos, chat, fórum, mídia, voz)
├── Posts (fórum)
├── Comentários
├── Eventos
├── Arquivos
└── Convites
```

---

## Backend (Rust/Axum)

### Estrutura de Arquivos

```
backend/
├── migrations/
│   ├── 064_create_communities.sql
│   ├── 065_create_community_members.sql
│   └── 066_create_community_channels.sql
├── src/
│   ├── models/
│   │   ├── mod.rs (atualizar)
│   │   └── community.rs
│   ├── handlers/
│   │   ├── mod.rs (atualizar)
│   │   └── communities.rs
│   └── routes.rs (atualizar)
```

### Migrations

#### 064_create_communities.sql

```sql
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    category VARCHAR(50),
    member_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communities_owner ON communities(owner_id);
CREATE INDEX idx_communities_visibility ON communities(visibility);
CREATE INDEX idx_communities_category ON communities(category);
```

#### 065_create_community_members.sql

```sql
CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    nickname VARCHAR(50),
    muted BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

CREATE INDEX idx_community_members_user ON community_members(user_id);
```

#### 066_create_community_channels.sql

```sql
CREATE TABLE IF NOT EXISTS community_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'CHAT',
    name VARCHAR(100) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_channels_community ON community_channels(community_id);
```

### Models (community.rs)

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Community {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub banner_url: Option<String>,
    pub owner_id: Uuid,
    pub visibility: String,
    pub category: Option<String>,
    pub member_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommunityMember {
    pub community_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub nickname: Option<String>,
    pub muted: bool,
    pub joined_at: DateTime<Utc>,
    // Joined fields
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CommunityChannel {
    pub id: Uuid,
    pub community_id: Uuid,
    pub r#type: String,
    pub name: String,
    pub description: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCommunityRequest {
    pub name: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub banner_url: Option<String>,
    pub visibility: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommunityRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub banner_url: Option<String>,
    pub visibility: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMemberRoleRequest {
    pub role: String,
}
```

### Handlers (communities.rs)

#### Endpoints MVP

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/communities` | Listar comunidades | Não |
| POST | `/communities` | Criar comunidade | Sim |
| GET | `/communities/discover` | Descobrir comunidades | Não |
| GET | `/communities/:id` | Detalhes da comunidade | Não |
| PATCH | `/communities/:id` | Atualizar comunidade | Owner/Admin |
| DELETE | `/communities/:id` | Deletar comunidade | Owner |
| POST | `/communities/:id/join` | Entrar na comunidade | Sim |
| POST | `/communities/:id/leave` | Sair da comunidade | Sim |
| GET | `/communities/:id/members` | Listar membros | Sim |
| PATCH | `/communities/:id/members/:user_id/role` | Alterar papel | Owner/Admin |
| DELETE | `/communities/:id/members/:user_id` | Remover membro | Owner/Admin/Mod |
| GET | `/communities/:id/channels` | Listar canais | Sim |
| POST | `/communities/:id/channels` | Criar canal | Admin |

#### Funções

```rust
pub async fn list_communities(State(pool): State<PgPool>) -> ...

pub async fn get_community(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>
) -> ...

pub async fn create_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateCommunityRequest>
) -> ...

pub async fn update_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCommunityRequest>
) -> ...

pub async fn delete_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>
) -> ...

pub async fn join_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>
) -> ...

pub async fn leave_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>
) -> ...

pub async fn list_members(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>
) -> ...

pub async fn update_member_role(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateMemberRoleRequest>
) -> ...

pub async fn remove_member(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, user_id)): Path<(Uuid, Uuid)>
) -> ...

pub async fn list_channels(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>
) -> ...

pub async fn create_channel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<serde_json::Value>
) -> ...

pub async fn discover_communities(
    State(pool): State<PgPool>
) -> ...
```

### Rotas

```rust
pub fn router() -> Router<PgPool> {
    Router::new()
        .route("/", get(list_communities).post(create_community))
        .route("/discover", get(discover_communities))
        .route("/:id", get(get_community).patch(update_community).delete(delete_community))
        .route("/:id/join", post(join_community))
        .route("/:id/leave", post(leave_community))
        .route("/:id/members", get(list_members))
        .route("/:id/members/:user_id/role", patch(update_member_role))
        .route("/:id/members/:user_id", delete(remove_member))
        .route("/:id/channels", get(list_channels).post(create_channel))
}
```

### Integração (routes.rs)

Adicionar:
```rust
.nest("/communities", handlers::communities::router())
```

---

## Frontend Web (Next.js)

### Estrutura de Arquivos

```
web/
├── lib/
│   └── api.ts (atualizar)
├── app/
│   └── comunidades/
│       ├── page.tsx (atualizar)
│       └── [id]/
│           └── page.tsx (novo)
└── components/
    └── community/
        ├── CommunityCard.tsx
        ├── CommunityHeader.tsx
        ├── ChannelSidebar.tsx
        └── MemberList.tsx
```

### API Functions (api.ts)

```typescript
// Interfaces
export interface Community {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  owner_id: string;
  visibility: string;
  category: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: string;
  nickname: string | null;
  muted: boolean;
  joined_at: string;
  username: string | null;
  avatar_url: string | null;
  name: string | null;
}

export interface CommunityChannel {
  id: string;
  community_id: string;
  type: string;
  name: string;
  description: string | null;
  position: number;
  created_at: string;
}

// Funções
export async function getCommunities(token?: string): Promise<{ communities: Community[] }>
export async function getCommunity(id: string): Promise<{ community: Community }>
export async function createCommunity(token: string, data: {...}): Promise<{ community: Community }>
export async function joinCommunity(token: string, id: string): Promise<{ status: string }>
export async function leaveCommunity(token: string, id: string): Promise<{ status: string }>
export async function getCommunityMembers(token: string, id: string): Promise<{ members: CommunityMember[] }>
export async function getCommunityChannels(token: string, id: string): Promise<{ channels: CommunityChannel[] }>
```

### Pages

#### comunidades/page.tsx (atualizar)
- Conectar com API real
- Substituir dados mock
- Adicionar loading states

#### comunidades/[id]/page.tsx (novo)
- Dashboard da comunidade
- Sidebar com canais
- Lista de membros
- Botão de entrar/sair

### Components

#### CommunityCard.tsx
- Card para listar comunidades
- Botão de entrar/sair
- Contador de membros

#### CommunityHeader.tsx
- Banner, ícone, nome
- Descrição
- Botão de ação

#### ChannelSidebar.tsx
- Lista de canais
- Navegação

#### MemberList.tsx
- Lista de membros
- Papéis (owner, admin, moderador, membro)

---

## Roadmap de Implementação

### Sprint 1 (MVP) - 1-2 semanas

#### Backend
1. ✅ Criar migrations SQL (064-066)
2. ✅ Criar models/community.rs
3. ✅ Criar handlers/communities.rs
4. ✅ Integrar rotas no routes.rs
5. ✅ Testar com `cargo build`

#### Frontend
1. ✅ Atualizar api.ts com funções de comunidade
2. ✅ Atualizar page.tsx para usar API real
3. ✅ Criar page.tsx para detalhes da comunidade
4. ✅ Criar componentes básicos

### Sprint 2 - 1 semana

#### Backend
- Sistema de canais completo
- Chat dentro de canais

#### Frontend
- Chat interface
- Seleção de canais

### Sprint 3 - 1 semana

#### Backend
- Fórum com posts/comentários
- Sistema de membros e papéis completo

#### Frontend
- Forum interface
- Gerenciamento de membros

### Sprint 4 - 1 semana

#### Backend
- Eventos
- Arquivos
- Sistema de convites
- Notificações

#### Frontend
- Eventos UI
- Upload de arquivos
- Modal de convites

---

## Permissões

| Ação | Owner | Admin | Moderador | Membro |
|------|-------|-------|-----------|--------|
| Deletar comunidade | ✅ | ❌ | ❌ | ❌ |
| Alterar owner | ✅ | ❌ | ❌ | ❌ |
| Editar comunidade | ✅ | ✅ | ❌ | ❌ |
| Criar canais | ✅ | ✅ | ❌ | ❌ |
| Criar eventos | ✅ | ✅ | ❌ | ❌ |
| Remover membros | ✅ | ✅ | ❌ | ❌ |
| Apagar mensagens | ✅ | ✅ | ✅ | ❌ |
| Expulsar usuários | ✅ | ✅ | ✅ | ❌ |
| Conversar | ✅ | ✅ | ✅ | ✅ |
| Comentar | ✅ | ✅ | ✅ | ✅ |

---

## Visibilidade das Comunidades

| Valor | Descrição |
|-------|-----------|
| PUBLIC | Visível para todos, qualquer um pode entrar |
| PRIVATE | Visível para todos, precisa de aprovação para entrar |
| INVITE_ONLY | Só aparece para quem tem convite |

---

## Notas

- O MVP foca em CRUD básico e gestão de membros
- Features como chat, fórum, eventos serão implementadas nas fases seguintes
- O backend será compartilhado entre web e mobile
- Seguir os padrões existentes do projeto (Axum, SQLx, etc)
