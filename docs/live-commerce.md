# Planejamento de Feature: Live Commerce

Este documento descreve as especificações técnicas, o esquema do banco de dados, o fluxo de comunicação em tempo real e o design de UX/UI para a funcionalidade de **Live Commerce** (Transmissões ao Vivo com Compras e Interatividade).

---

## 📋 Visão Geral
A funcionalidade de **Live Commerce** une o ecossistema social (Stories/Clipes) com o comercial (Marketplace/Delivery).
* **Atores:**
  * **Lojistas/Publishers:** Iniciam uma transmissão ao vivo de vídeo a partir do aplicativo móvel, destacando produtos de sua loja física/virtual.
  * **Espectadores/Clientes:** Assistem à live, interagem via chat em tempo real e compram os produtos apresentados com um fluxo de checkout rápido de 1 clique, sem sair ou pausar a transmissão.

---

## 🗄️ Esquema do Banco de Dados (Schema de Migração)
Para dar suporte ao Live Commerce, adicionaremos tabelas para rastrear as transmissões (`live_streams`), a associação de produtos em destaque na live (`live_stream_products`) e a moderação do chat integrado (`live_stream_chats`).

```sql
-- migration: XXX_create_live_commerce.sql

-- 1. Tabela Principal de Live Streams
CREATE TABLE live_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    stream_key VARCHAR(100) NOT NULL UNIQUE, -- Chave para o servidor de mídia (ex: RTMP/HLS)
    playback_url VARCHAR(255),               -- URL de streaming (HLS/WebRTC)
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

-- 2. Tabela de Associação de Produtos à Live
CREATE TABLE live_stream_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    is_featured BOOLEAN DEFAULT FALSE,  -- Se o produto está ativamente destacado na tela agora
    featured_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_live_stream_products_active ON live_stream_products(live_stream_id, is_featured);

-- 3. Histórico de Chat e Reações na Live (Opcional, caso queira guardar para lives gravadas)
CREATE TABLE live_stream_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    live_stream_id UUID NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## ⚡ Fluxo e Comunicação em Tempo Real (WebSockets)
A interatividade imediata exige comunicação via WebSockets. Utilizaremos o servidor **Axum (Rust)** para gerenciar as salas de live.

### Eventos WebSocket (WS):
1. **`live:join` (Espectador -> Servidor):**
   * Espectador entra na sala de ID da live.
   * Adiciona a conexão do usuário ao grupo da live na memória (dashmap/Redis).
2. **`live:viewer_update` (Servidor -> Todos):**
   * Transmite a contagem atualizada de espectadores em tempo real.
3. **`live:chat_message` (Espectador -> Servidor -> Todos):**
   * Envia uma mensagem de texto que é retransmitida imediatamente para todos na sala.
4. **`live:product_highlight` (Lojista -> Servidor -> Todos):**
   * O lojista clica em "Destacar Produto A". O servidor atualiza `is_featured` no banco e notifica todos os clientes conectados.
   * O aplicativo cliente exibe um pop-up dinâmico sobre o vídeo com a foto do produto, preço e botão "Comprar Já".

---

## 🎨 Design de UX/UI & Layout

### 📺 Tela do Espectador (Mobile / Web)
* **Fundo:** Vídeo em tela cheia na proporção 9:16 (vertical).
* **Overlay Superior:**
  * Canto esquerdo: Nome e avatar da loja, botão de "Seguir" e contador de visualizações em tempo real com indicador vermelho de **"AO VIVO"**.
  * Canto direito: Botão de fechar/minimizar a live (Picture-in-Picture).
* **Overlay Inferior Esquerdo (Chat):**
  * Um chat com transparência de fundo, mostrando as últimas 4 mensagens enviadas.
  * Input de texto discreto com botão para enviar reações rápidas (corações, palmas).
* **Overlay Inferior Direito (Carrossel de Produtos):**
  * Ícone flutuante de "Sacola de Compras" com indicador de quantidade de produtos vinculados.
  * **Card de Destaque:** Pop-up interativo horizontal exibindo o produto que o apresentador está mostrando no momento, com imagem, título, preço promocional e botão chamativo de **"Comprar em 1 Clique"**.

---

## 🛠️ Arquitetura do Backend (Axum / Rust)
Estrutura sugerida de endpoints para rotas REST e WebSocket:

```rust
// backend/src/routes/live.rs

// Endpoints REST
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/lives", post(create_live_stream))           // Lojista agenda/cria
        .route("/lives/active", get(list_active_lives))      // Listagem no app
        .route("/lives/:id/products", post(add_live_product)) // Vincular produtos
        .route("/lives/:id/highlight", put(highlight_product)) // Destacar produto na tela
        .route("/lives/:id/ws", get(live_ws_handler))         // Conexão WebSocket para chat
}
```

---

## ✅ Próximos Passos
1. **Criar a Migração do Banco:** Gerar o arquivo SQL em `backend/migrations`.
2. **Desenvolver o WebSocket Handler:** Criar o canal de eventos em Rust para gerenciar as transmissões de chat e produto em destaque.
3. **Integrar Servidor de Mídia:** Configurar um serviço para processamento do fluxo de vídeo (ex: AWS IVS, Livekit ou RTMP local).
4. **Interface Web/Mobile:** Criar a visualização da live no Next.js (`web`) e na aplicação mobile.
