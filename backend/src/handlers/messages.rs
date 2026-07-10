use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::message::Message;
use crate::ws;

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: Option<String>,
    pub image_url: Option<String>,
}

pub async fn send_message(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
    Json(body): Json<SendMessageRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let has_content = body.content.as_deref().map(|c| !c.trim().is_empty()).unwrap_or(false);
    let has_image = body.image_url.as_deref().map(|i| !i.is_empty()).unwrap_or(false);

    if !has_content && !has_image {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "message content or image is required" })),
        ));
    }

    let is_participant: Option<(Uuid,)> = sqlx::query_as(
        "SELECT chat_id FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_participant.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a participant of this chat" })),
        ));
    }

    let msg = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (chat_id, sender_id, content, image_url)
         VALUES ($1, $2, $3, $4)
         RETURNING
            id,
            chat_id,
            sender_id,
            (SELECT username FROM users WHERE id = $2) AS sender_username,
            content,
            image_url,
            created_at",
    )
    .bind(chat_id)
    .bind(auth.0)
    .bind(body.content.as_deref().unwrap_or(""))
    .bind(&body.image_url)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to send message" })),
        )
    })?;

    let _ = ws_state
        .broadcast(chat_id, &serde_json::to_string(&json!({"type": "new_message", "message": msg})).unwrap())
        .await;

    // Notify all participants of this chat to refresh their chat lists
    let participants: Vec<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM chat_participants WHERE chat_id = $1"
    )
    .bind(chat_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    for (p_id,) in participants {
        let update_msg = json!({
            "type": "chat_list_update",
            "chat_id": chat_id
        }).to_string();
        call_manager.send_to_user(p_id, &update_msg);
    }

    let sender_name = msg.sender_username.clone();
    let push_body = body.content.clone().unwrap_or_default();
    let push_text = if push_body.is_empty() { "📷 Image".to_string() } else { push_body };
    tokio::spawn(async move {
        crate::push::send_push_notification(&pool, chat_id, &sender_name, &push_text, auth.0).await;
    });

    Ok(Json(json!({ "message": msg })))
}

pub async fn get_messages(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_participant: Option<(Uuid,)> = sqlx::query_as(
        "SELECT chat_id FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_participant.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a participant of this chat" })),
        ));
    }

    // Update last_read_at for this participant to mark all messages as read
    let _ = sqlx::query("UPDATE chat_participants SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2")
        .bind(chat_id)
        .bind(auth.0)
        .execute(&pool)
        .await;

    let messages = sqlx::query_as::<_, Message>(
        "SELECT m.id, m.chat_id, m.sender_id, u.username AS sender_username, m.content, m.image_url, m.created_at
         FROM messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.chat_id = $1
         ORDER BY m.created_at ASC",
    )
    .bind(chat_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    Ok(Json(json!({ "messages": messages })))
}

pub async fn mark_chat_read(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_participant: Option<(Uuid,)> = sqlx::query_as(
        "SELECT chat_id FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_participant.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a participant of this chat" })),
        ));
    }

    sqlx::query("UPDATE chat_participants SET last_read_at = NOW() WHERE chat_id = $1 AND user_id = $2")
        .bind(chat_id)
        .bind(auth.0)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to update last read status" })),
            )
        })?;

    Ok(Json(json!({ "status": "success" })))
}
