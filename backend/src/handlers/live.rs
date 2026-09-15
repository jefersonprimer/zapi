use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post, put},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::live::{LiveStream, LiveStreamProduct, LiveStreamMessage};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateLiveRequest {
    pub store_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub scheduled_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct AddProductRequest {
    pub product_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct HighlightProductRequest {
    pub product_id: Uuid,
    pub is_featured: bool,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub message: String,
}

// 1. Criar uma Live Stream (Lojista)
pub async fn create_live_stream(
    State(pool): State<PgPool>,
    user: AuthUser,
    Json(body): Json<CreateLiveRequest>,
) -> Result<Json<LiveStream>, (StatusCode, Json<Value>)> {
    let stream_key = format!("stream_{}_{}", body.store_id, Uuid::new_v4().to_string().replace("-", ""));
    let playback_url = Some(format!("https://stream.zapi.app/hls/{}/index.m3u8", stream_key));

    let live = sqlx::query_as::<_, LiveStream>(
        "INSERT INTO live_streams (store_id, publisher_id, title, description, stream_key, playback_url, status, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7)
         RETURNING *"
    )
    .bind(body.store_id)
    .bind(user.0)
    .bind(body.title)
    .bind(body.description)
    .bind(stream_key)
    .bind(playback_url)
    .bind(body.scheduled_at)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;


    Ok(Json(live))
}

// 2. Listar Lives Ativas/Ao Vivo
pub async fn list_active_lives(
    State(pool): State<PgPool>,
) -> Result<Json<Vec<LiveStream>>, (StatusCode, Json<Value>)> {
    let lives = sqlx::query_as::<_, LiveStream>(
        "SELECT * FROM live_streams WHERE status = 'live' ORDER BY started_at DESC"
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(lives))
}

// 3. Vincular Produto à Live Stream
pub async fn add_live_product(
    State(pool): State<PgPool>,
    Path(live_id): Path<Uuid>,
    _user: AuthUser,
    Json(body): Json<AddProductRequest>,
) -> Result<Json<LiveStreamProduct>, (StatusCode, Json<Value>)> {
    let live_product = sqlx::query_as::<_, LiveStreamProduct>(
        "INSERT INTO live_stream_products (live_stream_id, product_id)
         VALUES ($1, $2)
         RETURNING *"
    )
    .bind(live_id)
    .bind(body.product_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(live_product))
}

// 4. Destacar um Produto na Tela da Live (e notificar via WebSocket)
pub async fn highlight_product(
    State(state): State<AppState>,
    Path(live_id): Path<Uuid>,
    _user: AuthUser,
    Json(body): Json<HighlightProductRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mut tx = state.pool.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Desativar destaque de todos os produtos dessa live primeiro
    sqlx::query(
        "UPDATE live_stream_products SET is_featured = FALSE, featured_at = NULL WHERE live_stream_id = $1"
    )
    .bind(live_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Se o destaque for verdadeiro, ativar para o produto específico
    if body.is_featured {
        sqlx::query(
            "UPDATE live_stream_products SET is_featured = TRUE, featured_at = NOW() WHERE live_stream_id = $1 AND product_id = $2"
        )
        .bind(live_id)
        .bind(body.product_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Notificar clientes conectados via WebSocket
    let ws_msg = json!({
        "type": "live:product_highlight",
        "live_stream_id": live_id,
        "product_id": body.product_id,
        "is_featured": body.is_featured
    });
    state.ws.broadcast(live_id, &ws_msg.to_string()).await;

    Ok(Json(json!({ "success": true })))
}

// 5. Enviar Mensagem no Chat da Live
pub async fn send_live_message(
    State(state): State<AppState>,
    Path(live_id): Path<Uuid>,
    user: AuthUser,
    Json(body): Json<SendMessageRequest>,
) -> Result<Json<LiveStreamMessage>, (StatusCode, Json<Value>)> {
    let message = sqlx::query_as::<_, LiveStreamMessage>(
        "INSERT INTO live_stream_messages (live_stream_id, user_id, message)
         VALUES ($1, $2, $3)
         RETURNING *"
    )
    .bind(live_id)
    .bind(user.0)
    .bind(&body.message)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    // Buscar nome do usuário do banco
    let user_name: Option<String> = sqlx::query_scalar(
        "SELECT name FROM users WHERE id = $1"
    )
    .bind(user.0)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    let display_name = user_name.unwrap_or_else(|| "Usuário".to_string());

    // Notificar clientes conectados via WebSocket
    let ws_msg = json!({
        "type": "live:chat_message",
        "live_stream_id": live_id,
        "message_id": message.id,
        "user_id": user.0,
        "user_name": display_name,
        "message": body.message,
        "created_at": message.created_at
    });
    state.ws.broadcast(live_id, &ws_msg.to_string()).await;

    Ok(Json(message))
}

// 6. Iniciar a Live (Lojista)
pub async fn start_live_stream(
    State(pool): State<PgPool>,
    Path(live_id): Path<Uuid>,
    _user: AuthUser,
) -> Result<Json<LiveStream>, (StatusCode, Json<Value>)> {
    let live = sqlx::query_as::<_, LiveStream>(
        "UPDATE live_streams SET status = 'live', started_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(live_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(live))
}

// 7. Finalizar a Live (Lojista)
pub async fn end_live_stream(
    State(pool): State<PgPool>,
    Path(live_id): Path<Uuid>,
    _user: AuthUser,
) -> Result<Json<LiveStream>, (StatusCode, Json<Value>)> {
    let live = sqlx::query_as::<_, LiveStream>(
        "UPDATE live_streams SET status = 'ended', ended_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *"
    )
    .bind(live_id)
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))))?;

    Ok(Json(live))
}

// Router para ser montado no roteador principal
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_live_stream))
        .route("/active", get(list_active_lives))
        .route("/:id/products", post(add_live_product))
        .route("/:id/highlight", put(highlight_product))
        .route("/:id/messages", post(send_live_message))
        .route("/:id/start", post(start_live_stream))
        .route("/:id/end", post(end_live_stream))
}

