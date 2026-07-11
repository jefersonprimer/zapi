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

    // Check if either user has blocked the other (only for direct/1-to-1 chats)
    let is_blocked = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS (
            SELECT 1 
            FROM chat_participants cp
            JOIN chats c ON c.id = cp.chat_id
            JOIN contacts con ON (
                (con.user_id = cp.user_id AND con.contact_id = $2 AND con.is_blocked = true)
                OR
                (con.user_id = $2 AND con.contact_id = cp.user_id AND con.is_blocked = true)
            )
            WHERE cp.chat_id = $1 AND cp.user_id != $2 AND c.is_group = false
        )
        "#
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .unwrap_or(false);

    if is_blocked {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "chat_blocked",
                "message": "Não é possível enviar mensagens. O usuário está bloqueado."
            })),
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
            created_at,
            deleted_for_everyone",
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
    let push_text = if push_body.trim().is_empty() {
        if let Some(ref url) = body.image_url {
            let url_lower = url.to_lowercase();
            if url_lower.ends_with(".jpg")
                || url_lower.ends_with(".jpeg")
                || url_lower.ends_with(".png")
                || url_lower.ends_with(".gif")
                || url_lower.ends_with(".webp")
            {
                "📷 Foto".to_string()
            } else if url_lower.ends_with(".m4a")
                || url_lower.ends_with(".mp3")
                || url_lower.ends_with(".wav")
                || url_lower.ends_with(".caf")
                || url_lower.ends_with(".ogg")
                || url_lower.ends_with(".3gp")
                || url_lower.ends_with(".opus")
                || url_lower.contains("audio")
            {
                "🎵 Áudio".to_string()
            } else if url_lower.ends_with(".mp4")
                || url_lower.ends_with(".mov")
                || url_lower.ends_with(".webm")
                || url_lower.ends_with(".mkv")
                || url_lower.ends_with(".avi")
            {
                "🎥 Vídeo".to_string()
            } else {
                "📁 Arquivo".to_string()
            }
        } else {
            "Mensagem".to_string()
        }
    } else {
        push_body
    };
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
        "SELECT m.id, m.chat_id, m.sender_id, u.username AS sender_username, m.content, m.image_url, m.created_at, m.deleted_for_everyone
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

#[derive(sqlx::FromRow)]
struct MessageDeleteMeta {
    sender_id: Uuid,
    chat_id: Uuid,
    image_url: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn delete_message(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Path((chat_id, message_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // 1. Fetch message metadata to verify
    let message: Option<MessageDeleteMeta> = sqlx::query_as(
        "SELECT sender_id, chat_id, image_url, created_at FROM messages WHERE id = $1"
    )
    .bind(message_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Error fetching message: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    let meta = match message {
        Some(m) => m,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "message not found" })),
            ));
        }
    };

    // 2. Authorization check
    if meta.sender_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the sender can delete the message for everyone" })),
        ));
    }

    if meta.chat_id != chat_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "message does not belong to this chat" })),
        ));
    }

    // 3. Time validation (24-hour limit)
    let now = chrono::Utc::now();
    if now.signed_duration_since(meta.created_at) > chrono::Duration::hours(24) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "messages older than 24 hours cannot be deleted for everyone" })),
        ));
    }

    // 4. Update DB (Soft Delete - Tombstone)
    sqlx::query(
        "UPDATE messages 
         SET content = NULL, image_url = NULL, deleted_for_everyone = TRUE, deleted_at = NOW() 
         WHERE id = $1"
    )
    .bind(message_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Error soft-deleting message: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to delete message" })),
        )
    })?;

    // 5. Async physical file deletion (if image_url is present)
    if let Some(url) = meta.image_url {
        if url.starts_with("/uploads/") {
            let relative_path = url.trim_start_matches('/').to_string();
            tokio::spawn(async move {
                let filepath = std::path::Path::new(&relative_path).to_path_buf();
                if let Err(e) = tokio::fs::remove_file(&filepath).await {
                    tracing::error!("Failed to delete physical file {:?}: {}", filepath, e);
                } else {
                    tracing::debug!("Successfully deleted physical file {:?}", filepath);
                }
            });
        }
    }

    // 6. Broadcast via WebSocket
    let ws_event = json!({
        "type": "message_deleted",
        "chat_id": chat_id,
        "message_id": message_id
    }).to_string();
    let _ = ws_state.broadcast(chat_id, &ws_event).await;

    // 7. Notify participants to refresh chat list
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

    Ok(Json(json!({ "status": "success", "message_id": message_id })))
}

pub async fn clear_chat_messages(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if participant
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

    // Delete physical media files associated with the messages
    let messages_with_images: Vec<(Option<String>,)> = sqlx::query_as(
        "SELECT image_url FROM messages WHERE chat_id = $1 AND image_url IS NOT NULL"
    )
    .bind(chat_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    for (url_opt,) in messages_with_images {
        if let Some(url) = url_opt {
            if url.starts_with("/uploads/") {
                let relative_path = url.trim_start_matches('/').to_string();
                tokio::spawn(async move {
                    let filepath = std::path::Path::new(&relative_path).to_path_buf();
                    let _ = tokio::fs::remove_file(&filepath).await;
                });
            }
        }
    }

    // Delete all messages in the database
    sqlx::query("DELETE FROM messages WHERE chat_id = $1")
        .bind(chat_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
        })?;

    // Broadcast clear event via WebSocket
    let ws_event = json!({
        "type": "messages_cleared",
        "chat_id": chat_id
    }).to_string();
    let _ = ws_state.broadcast(chat_id, &ws_event).await;

    // Notify participants to refresh chat list (since last message is deleted)
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

    Ok(Json(json!({ "status": "success", "chat_id": chat_id })))
}

