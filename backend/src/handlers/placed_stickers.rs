use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::message::MessagePlacedSticker;
use crate::ws;

#[derive(Debug, Deserialize)]
pub struct PlaceStickerRequest {
    pub sticker_url: String,
    pub x_offset: f32,
    pub y_offset: f32,
    pub scale_factor: f32,
    pub rotation: f32,
}

/// POST /chats/:chat_id/messages/:message_id/stickers
///
/// Places or updates a sticker on a message.
pub async fn place_sticker(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
    auth: AuthUser,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<PlaceStickerRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Verify if message exists in the specified chat
    let message_exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM messages WHERE id = $1 AND chat_id = $2"
    )
    .bind(message_id)
    .bind(chat_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Database query error: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if message_exists.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "message not found in this chat" })),
        ));
    }

    // Insert or update (if same user places a sticker on same message, we can upside it or add a new one)
    // For simplicity, we allow multiple stickers, but if the exact same URL is placed by the same user, we update its coordinates.
    let sticker = sqlx::query_as::<_, MessagePlacedSticker>(
        r#"
        INSERT INTO message_placed_stickers (message_id, user_id, sticker_url, x_offset, y_offset, scale_factor, rotation)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
        RETURNING id, message_id, user_id, sticker_url, x_offset, y_offset, scale_factor, rotation, created_at
        "#
    )
    .bind(message_id)
    .bind(auth.0)
    .bind(&body.sticker_url)
    .bind(body.x_offset)
    .bind(body.y_offset)
    .bind(body.scale_factor)
    .bind(body.rotation)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to place sticker: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    // If CONFLICT (DO NOTHING returned None), let's insert it without conflict check
    let final_sticker = match sticker {
        Some(s) => s,
        None => {
            sqlx::query_as::<_, MessagePlacedSticker>(
                r#"
                INSERT INTO message_placed_stickers (message_id, user_id, sticker_url, x_offset, y_offset, scale_factor, rotation)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, message_id, user_id, sticker_url, x_offset, y_offset, scale_factor, rotation, created_at
                "#
            )
            .bind(message_id)
            .bind(auth.0)
            .bind(&body.sticker_url)
            .bind(body.x_offset)
            .bind(body.y_offset)
            .bind(body.scale_factor)
            .bind(body.rotation)
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to insert sticker fallback: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "database error" })),
                )
            })?
        }
    };

    // Broadcast Webhook event
    let ws_event = json!({
        "type": "sticker_placed",
        "chat_id": chat_id,
        "message_id": message_id,
        "sticker": final_sticker
    }).to_string();
    
    let _ = ws_state.broadcast(chat_id, &ws_event).await;

    Ok(Json(json!(final_sticker)))
}

/// DELETE /chats/:chat_id/messages/:message_id/stickers/:sticker_id
///
/// Removes a placed sticker from a message.
pub async fn remove_sticker(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
    auth: AuthUser,
    Path((chat_id, message_id, sticker_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Verify owner or if participant
    let sticker_owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM message_placed_stickers WHERE id = $1 AND message_id = $2"
    )
    .bind(sticker_id)
    .bind(message_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to find sticker: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    let owner_id = match sticker_owner {
        Some(uid) => uid,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "placed sticker not found" })),
            ));
        }
    };

    if owner_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you do not own this sticker placement" })),
        ));
    }

    sqlx::query("DELETE FROM message_placed_stickers WHERE id = $1")
        .bind(sticker_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete sticker: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "database error" })),
            )
        })?;

    // Broadcast WebSocket deletion event
    let ws_event = json!({
        "type": "sticker_removed",
        "chat_id": chat_id,
        "message_id": message_id,
        "sticker_id": sticker_id
    }).to_string();

    let _ = ws_state.broadcast(chat_id, &ws_event).await;

    Ok(Json(json!({ "status": "deleted" })))
}
