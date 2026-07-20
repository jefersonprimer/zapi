# Plano: Delivery MVP (iFood Lite)

Delivery integrado ao ZAPI. Cliente pede comida em poucos toques, vendedor cadastra
loja pelo celular em menos de 5 minutos. PIX como pagamento.

---

## V1 - MVP

### O que o cliente faz
- Ver lojas da sua cidade
- Buscar loja por nome
- Ver cardapio da loja
- Adicionar produtos ao carrinho
- Escolher endereco de entrega
- Pagar via PIX
- Fazer pedido
- Ver status do pedido

### O que o vendedor faz
- Criar loja
- Abrir/Fechar loja
- Adicionar produtos
- Receber pedidos
- Alterar status do pedido

---

## 5 Tabelas (3 Migrations)

### 045 - user_addresses

```sql
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
```

### 046 - stores + store_products + orders + order_items

```sql
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar TEXT,
    phone VARCHAR(20),
    pix_key VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'restaurante', 'padaria', 'mercado', 'farmacia',
        'fast_food', 'lanchonete', 'confeitaria', 'acougue',
        'bebidas', 'outro'
    )),
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    minimum_order DECIMAL(10,2) DEFAULT 0.00,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(2) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_city ON stores(state, city);
CREATE INDEX idx_stores_category ON stores(category);

CREATE TABLE store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_store_products_store ON store_products(store_id);

CREATE TYPE order_status AS ENUM (
    'pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    status order_status NOT NULL DEFAULT 'pendente',
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    observation TEXT,
    address_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_store ON orders(store_id);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store_products(id),
    product_name VARCHAR(255) NOT NULL,
    product_image TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    observation TEXT
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

**address_snapshot:**
```json
{"label":"casa","estado":"SP","cidade":"Sao Paulo","bairro":"Centro",
 "cep":"01234-567","rua":"Rua Exemplo","numero":"123","ponto_referencia":"frente padaria"}
```

---

## Backend

### Models (`backend/src/models/delivery.rs`)

```rust
pub struct UserAddress {
    pub id: Uuid, pub user_id: Uuid, pub label: String,
    pub estado: String, pub cidade: String, pub bairro: String,
    pub cep: String, pub rua: String, pub numero: String,
    pub ponto_referencia: Option<String>, pub is_default: bool,
    pub created_at: DateTime<Utc>, pub updated_at: DateTime<Utc>,
}

pub struct Store {
    pub id: Uuid, pub owner_id: Uuid, pub name: String,
    pub description: Option<String>, pub avatar: Option<String>,
    pub phone: Option<String>, pub pix_key: String,
    pub category: String, pub delivery_fee: f64,
    pub minimum_order: f64, pub city: String, pub state: String,
    pub is_open: bool,
    pub created_at: DateTime<Utc>, pub updated_at: DateTime<Utc>,
}

pub struct StoreProduct {
    pub id: Uuid, pub store_id: Uuid, pub name: String,
    pub description: Option<String>, pub price: f64,
    pub image: Option<String>, pub is_available: bool,
    pub created_at: DateTime<Utc>, pub updated_at: DateTime<Utc>,
}

pub struct Order {
    pub id: Uuid, pub user_id: Uuid, pub store_id: Uuid,
    pub status: String, pub subtotal: f64, pub delivery_fee: f64,
    pub total: f64, pub observation: Option<String>,
    pub address_snapshot: serde_json::Value,
    pub created_at: DateTime<Utc>, pub updated_at: DateTime<Utc>,
}

pub struct OrderItem {
    pub id: Uuid, pub order_id: Uuid, pub product_id: Uuid,
    pub product_name: String, pub product_image: Option<String>,
    pub quantity: i32, pub unit_price: f64, pub subtotal: f64,
    pub observation: Option<String>,
}
```

### Request Types

```rust
pub struct CreateAddressRequest {
    pub label: String, pub estado: String, pub cidade: String,
    pub bairro: String, pub cep: String, pub rua: String,
    pub numero: String, pub ponto_referencia: Option<String>,
    pub is_default: Option<bool>,
}

pub struct CreateStoreRequest {
    pub name: String, pub description: Option<String>,
    pub avatar: Option<String>, pub phone: Option<String>,
    pub pix_key: String, pub category: String,
    pub delivery_fee: Option<f64>, pub minimum_order: Option<f64>,
    pub city: String, pub state: String,
}

pub struct CreateProductRequest {
    pub name: String, pub description: Option<String>,
    pub price: f64, pub image: Option<String>,
}

pub struct CreateOrderRequest {
    pub store_id: Uuid, pub address_id: Uuid,
    pub items: Vec<OrderItemRequest>,
    pub observation: Option<String>,
}

pub struct OrderItemRequest {
    pub product_id: Uuid, pub quantity: i32,
    pub observation: Option<String>,
}

pub struct UpdateOrderStatusRequest {
    pub status: String,
}
```

### Endpoints

**Enderecos:**
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/delivery/addresses` | Listar |
| POST | `/delivery/addresses` | Criar |
| PUT | `/delivery/addresses/:id` | Atualizar |
| DELETE | `/delivery/addresses/:id` | Deletar |

**Lojas:**
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/delivery/stores?state=&city=&category=` | Listar (cidade+categoria) |
| GET | `/delivery/stores?q=` | Buscar por nome |
| GET | `/delivery/stores/:id` | Detalhes + produtos |
| POST | `/delivery/stores` | Criar (vendedor) |
| PUT | `/delivery/stores/:id` | Atualizar (owner) |
| PATCH | `/delivery/stores/:id/toggle` | Abrir/fechar (owner) |
| GET | `/delivery/vendor/stores` | Minha loja (vendedor) |

**Produtos:**
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/delivery/stores/:id/products` | Listar |
| POST | `/delivery/stores/:id/products` | Criar (owner) |
| PUT | `/delivery/products/:id` | Atualizar (owner) |
| DELETE | `/delivery/products/:id` | Deletar (owner) |

**Pedidos:**
| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/delivery/orders` | Criar (cliente) |
| GET | `/delivery/orders` | Meus pedidos (cliente) |
| GET | `/delivery/orders/:id` | Detalhes |
| GET | `/delivery/vendor/orders` | Pedidos recebidos (vendedor) |
| PUT | `/delivery/orders/:id/status` | Atualizar status (vendedor) |

**PIX:**
| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/delivery/stores/:id/pix` | Chave PIX da loja (via owner) |

---

## Mobile

### Telas

```
app/(tabs)/delivery.tsx          # Feed de lojas
app/delivery/[storeId].tsx       # Cardapio da loja
app/delivery/cart.tsx            # Carrinho
app/delivery/checkout.tsx        # Finalizar pedido
app/delivery/orders.tsx          # Meus pedidos
app/delivery/orders/[id].tsx     # Status do pedido
app/delivery/addresses.tsx       # Gerenciar enderecos
app/delivery/vendor/dashboard.tsx    # Dashboard vendedor
app/delivery/vendor/create-store.tsx # Criar loja
app/delivery/vendor/products.tsx     # Gerenciar produtos
```

### Servico API

```
mobile/services/deliveryApi.ts
```

### Carrinho (Zustand)

```typescript
// mobile/store/useCartStore.ts
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  observation?: string;
  image?: string;
}

interface CartState {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
  addItem: (storeId: string, storeName: string, item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
}
```

Regra: uma loja por vez. Trocar de loja limpa o carrinho.

---

## Fluxos

### Cliente
```
Delivery (feed lojas) -> Loja (cardapio) -> Carrinho -> Checkout -> PIX -> Pedido -> Status
```

### Vendedor
```
Criar loja -> Cadastrar produtos -> Abrir loja -> Receber pedido -> Alterar status
```

### Status do Pedido
```
pendente -> confirmado -> preparando -> saiu_entrega -> entregue
```

### Calculo do Pedido
```
subtotal = sum(qtd * preco)
total = subtotal + store.delivery_fee
Validar: store.is_open, produtos disponiveis, store.minimum_order <= subtotal
```

---

## Notificacoes Push

Usar `notification_queue` existente:

| Evento | Destinatario | Titulo | Corpo |
|--------|-------------|--------|-------|
| Pedido criado | Vendedor | "Novo pedido!" | "Pedido de R$ XX.XX" |
| Confirmado | Cliente | "Pedido aceito!" | "Seu pedido foi aceito" |
| Saiu entrega | Cliente | "A caminho!" | "Seu pedido saiu pra entrega" |
| Entregue | Cliente | "Entregue!" | "Seu pedido foi entregue" |

---

## Ordem de Implementacao

### Fase 1 - Backend
1. Migration 045 (user_addresses)
2. Migration 046 (stores, store_products, orders, order_items)
3. `models/delivery.rs`
4. `handlers/delivery.rs` - enderecos
5. `handlers/delivery.rs` - lojas (CRUD + busca)
6. `handlers/delivery.rs` - produtos (CRUD)
7. `handlers/delivery.rs` - pedidos (criar, listar, status)
8. Atualizar `routes.rs`

### Fase 2 - Mobile Cliente
9. `deliveryApi.ts`
10. Feed de lojas
11. Tela da loja + cardapio
12. Carrinho (Zustand)
13. Checkout
14. Tela de pedidos

### Fase 3 - Mobile Vendedor
15. Criar loja
16. Dashboard
17. Gerenciar produtos

---

## Seguranca

- Owner so edita/deleta sua loja e produtos
- Vendedor so muda status dos pedidos da sua loja
- Cliente so ve seus proprios pedidos
- PIX da loja: busca pix_keys do owner via `owner_id`

---

## Arquivos Backend

```
backend/migrations/045_add_user_addresses.sql
backend/migrations/046_add_delivery.sql
backend/src/models/delivery.rs
backend/src/handlers/delivery.rs
backend/src/routes.rs  (adicionar .nest("/delivery", ...))
```

---

## V2 - Futuro

- Avaliacoes e notas
- Cupons de desconto
- Categorias de produtos
- Busca por produto
- Favoritar lojas
- Historico de pedidos
- Banner da loja
- Horarios por dia da semana
- GPS e distancia
- Promocoes
- Taxa dinamica de entrega
- Entregador em tempo real
- Agendamento de pedidos
- Cancelamento de pedido
- Chat cliente-vendedor
- CNPJ e verificacao
- Multi-imagens por produto
