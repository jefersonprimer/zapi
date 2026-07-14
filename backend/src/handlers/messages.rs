use axum::{extract::{Path, State, Query}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub since: Option<chrono::DateTime<chrono::Utc>>,
}
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::message::Message;
use crate::ws;

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: Option<String>,
    pub image_url: Option<String>,
    pub sha256: Option<String>,
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

    // Check recipient's privacy settings for messages in direct/1-to-1 chats
    let recipient_privacy: Option<(String, bool)> = sqlx::query_as(
        r#"
        SELECT u.privacy_messages,
               EXISTS(SELECT 1 FROM contacts con WHERE con.user_id = cp.user_id AND con.contact_id = $2) AS is_contact
        FROM chat_participants cp
        JOIN chats c ON c.id = cp.chat_id
        JOIN users u ON u.id = cp.user_id
        WHERE cp.chat_id = $1 AND cp.user_id != $2 AND c.is_group = false
        LIMIT 1
        "#
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .unwrap_or(None);

    if let Some((privacy, is_contact)) = recipient_privacy {
        if privacy == "nobody" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "privacy_messages_nobody",
                    "message": "Este usuário não recebe mensagens de ninguém."
                })),
            ));
        } else if privacy == "contacts" && !is_contact {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "privacy_messages_contacts",
                    "message": "Este usuário recebe mensagens apenas de contatos."
                })),
            ));
        }
    }

    let message_id = Uuid::now_v7();
    let mut msg = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (id, chat_id, sender_id, content, image_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING
            id,
            chat_id,
            sender_id,
            (SELECT username FROM users WHERE id = $3) AS sender_username,
            content,
            image_url,
            created_at,
            deleted_for_everyone,
            deleted_at",
    )
    .bind(message_id)
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

    // Unarchive the chat for participants who do not have keep_chats_archived enabled
    if let Err(e) = sqlx::query(
        "UPDATE chat_participants \
         SET is_archived = FALSE \
         FROM users \
         WHERE chat_participants.user_id = users.id \
           AND chat_participants.chat_id = $1 \
           AND users.keep_chats_archived = FALSE"
    )
    .bind(chat_id)
    .execute(&pool)
    .await
    {
        tracing::error!("failed to unarchive chat for participants: {}", e);
    }

    if let Some(ref url) = body.image_url {
        if !url.trim().is_empty() {
            let url_lower = url.to_lowercase();
            let att_type = if url_lower.contains("/audio/")
                || url_lower.contains("audio")
                || url_lower.ends_with(".mp3")
                || url_lower.ends_with(".wav")
                || url_lower.ends_with(".m4a")
                || url_lower.ends_with(".caf")
                || url_lower.ends_with(".ogg")
                || url_lower.ends_with(".opus")
            {
                "audio"
            } else if url_lower.ends_with(".jpg")
                || url_lower.ends_with(".jpeg")
                || url_lower.ends_with(".png")
                || url_lower.ends_with(".gif")
                || url_lower.ends_with(".webp")
            {
                "image"
            } else if url_lower.ends_with(".mp4")
                || url_lower.ends_with(".mov")
                || url_lower.ends_with(".webm")
                || url_lower.ends_with(".mkv")
                || url_lower.ends_with(".avi")
            {
                "video"
            } else {
                "document"
            };

            let att = sqlx::query_as::<_, crate::models::message::Attachment>(
                "INSERT INTO attachments (message_id, type, remote_url, sha256)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, message_id, type, remote_url, mime_type, width, height, duration, size, sha256, thumbnail_path"
            )
            .bind(msg.id)
            .bind(att_type)
            .bind(url)
            .bind(body.sha256.clone())
            .fetch_one(&pool)
            .await
            .ok();

            if let Some(a) = att {
                msg.attachments = Some(vec![a]);
            }
        }
    }


    msg.status = Some("sent".to_string());

    let _ = ws_state
        .broadcast(chat_id, &serde_json::to_string(&json!({"type": "new_message", "message": msg})).unwrap())
        .await;

    // Notify all participants of this chat to refresh their chat lists,
    // and deliver websocket or push notifications.
    let participants: Vec<(Uuid, Option<chrono::DateTime<chrono::Utc>>, Option<bool>)> = sqlx::query_as(
        "SELECT user_id, notification_muted_until, notification_muted_forever FROM chat_participants WHERE chat_id = $1"
    )
    .bind(chat_id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let mut offline_user_ids = Vec::new();
    for (p_id, p_muted_until, p_muted_forever) in &participants {
        let p_id = *p_id;
        let p_muted_forever = p_muted_forever.unwrap_or(false);
        if p_id != auth.0 {
            // Check if user muted notifications for this chat
            let is_muted = if p_muted_forever {
                true
            } else if let Some(until) = p_muted_until {
                *until > chrono::Utc::now()
            } else {
                false
            };

            let presence = call_manager.get_presence(p_id);
            match presence {
                Some(crate::signaling::PresenceState::Active) => {
                    // ONLINE_ACTIVE: only WS
                    let ws_notif = json!({
                        "type": "new_message_notification",
                        "chat_id": chat_id,
                        "message": msg.clone()
                    }).to_string();
                    call_manager.send_to_user(p_id, &ws_notif);
                }
                Some(crate::signaling::PresenceState::Background) => {
                    // ONLINE_BACKGROUND: WS + Push
                    let ws_notif = json!({
                        "type": "new_message_notification",
                        "chat_id": chat_id,
                        "message": msg.clone()
                    }).to_string();
                    call_manager.send_to_user(p_id, &ws_notif);
                    if !is_muted {
                        offline_user_ids.push(p_id);
                    }
                }
                None => {
                    // OFFLINE: only Push
                    if !is_muted {
                        offline_user_ids.push(p_id);
                    }
                }
            }
        }

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

    if !offline_user_ids.is_empty() {
        tokio::spawn(async move {
            crate::push::send_push_notification(&pool, chat_id, &sender_name, &push_text, offline_user_ids).await;
        });
    }

    Ok(Json(json!({ "message": msg })))
}

pub async fn get_messages(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
    Query(query): Query<GetMessagesQuery>,
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

    // Update last_read_at and last_delivered_at for this participant
    let _ = sqlx::query("UPDATE chat_participants SET last_read_at = NOW(), last_delivered_at = NOW() WHERE chat_id = $1 AND user_id = $2")
        .bind(chat_id)
        .bind(auth.0)
        .execute(&pool)
        .await;

    // Broadcast delivery event via WebSocket so the sender can turn checkmarks double-grey
    let ws_event = json!({
        "type": "messages_delivered",
        "chat_id": chat_id,
        "receiver_id": auth.0,
        "delivered_at": chrono::Utc::now()
    }).to_string();
    let _ = ws_state.broadcast(chat_id, &ws_event).await;

    let other_participants: Vec<(Uuid, Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
        "SELECT user_id, last_read_at, last_delivered_at FROM chat_participants WHERE chat_id = $1 AND user_id != $2"
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let is_group = sqlx::query_scalar::<_, bool>(
        "SELECT is_group FROM chats WHERE id = $1"
    )
    .bind(chat_id)
    .fetch_one(&pool)
    .await
    .unwrap_or_default();

    let (_other_id, other_read_at, other_delivered_at) = if !is_group && !other_participants.is_empty() {
        (Some(other_participants[0].0), other_participants[0].1, other_participants[0].2)
    } else {
        (None, None, None)
    };

    let mut messages = if let Some(since) = query.since {
        sqlx::query_as::<_, Message>(
            "SELECT m.id, m.chat_id, m.sender_id, u.username AS sender_username, m.content, m.image_url, m.created_at, m.deleted_for_everyone, m.deleted_at
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             JOIN chat_participants cp ON cp.chat_id = m.chat_id AND cp.user_id = $2
             WHERE m.chat_id = $1 
               AND (cp.cleared_at IS NULL OR m.created_at > cp.cleared_at)
               AND (m.created_at > $3 OR m.deleted_at > $3)
             ORDER BY m.created_at ASC",
        )
        .bind(chat_id)
        .bind(auth.0)
        .bind(since)
        .fetch_all(&pool)
        .await
    } else {
        // Initial load: return last 50 messages
        sqlx::query_as::<_, Message>(
            "SELECT m.id, m.chat_id, m.sender_id, u.username AS sender_username, m.content, m.image_url, m.created_at, m.deleted_for_everyone, m.deleted_at
             FROM (
                 SELECT * FROM messages 
                 WHERE chat_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 50
             ) m
             JOIN users u ON u.id = m.sender_id
             JOIN chat_participants cp ON cp.chat_id = m.chat_id AND cp.user_id = $2
             WHERE cp.cleared_at IS NULL OR m.created_at > cp.cleared_at
             ORDER BY m.created_at ASC",
        )
        .bind(chat_id)
        .bind(auth.0)
        .fetch_all(&pool)
        .await
    }
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if !messages.is_empty() {
        let msg_ids: Vec<Uuid> = messages.iter().map(|m| m.id).collect();
        
        let attachments = sqlx::query_as::<_, crate::models::message::Attachment>(
            "SELECT id, message_id, type, remote_url, mime_type, width, height, duration, size, sha256, thumbnail_path 
             FROM attachments 
             WHERE message_id = ANY($1)"
        )
        .bind(&msg_ids)
        .fetch_all(&pool)
        .await
        .unwrap_or_default();

        for msg in &mut messages {
            let msg_atts: Vec<_> = attachments
                .iter()
                .filter(|a| a.message_id == msg.id)
                .cloned()
                .collect();
            msg.attachments = Some(msg_atts);

            // Compute message status on the fly for A's own messages
            if msg.sender_id == auth.0 {
                let status = if is_group {
                    "sent"
                } else {
                    match other_read_at {
                        Some(read_time) if msg.created_at <= read_time => "read",
                        _ => match other_delivered_at {
                            Some(delivered_time) if msg.created_at <= delivered_time => "delivered",
                            _ => "sent",
                        }
                    }
                };
                msg.status = Some(status.to_string());
            }
        }
    }

    Ok(Json(json!({ "messages": messages })))
}

pub async fn mark_chat_read(
    State(pool): State<PgPool>,
    State(ws_state): State<ws::WsState>,
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

    sqlx::query("UPDATE chat_participants SET last_read_at = NOW(), last_delivered_at = NOW() WHERE chat_id = $1 AND user_id = $2")
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

    // Broadcast read event via WebSocket so the sender can turn the checkmarks blue
    let ws_event = json!({
        "type": "messages_read",
        "chat_id": chat_id,
        "reader_id": auth.0,
        "read_at": chrono::Utc::now()
    }).to_string();
    let _ = ws_state.broadcast(chat_id, &ws_event).await;

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
    State(_ws_state): State<ws::WsState>,
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

    // Set cleared_at = NOW() for the requesting user in chat_participants
    sqlx::query("UPDATE chat_participants SET cleared_at = NOW() WHERE chat_id = $1 AND user_id = $2")
        .bind(chat_id)
        .bind(auth.0)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
        })?;

    // Send clear event via WebSocket only to the user who cleared the chat
    let ws_event = json!({
        "type": "messages_cleared",
        "chat_id": chat_id
    }).to_string();
    call_manager.send_to_user(auth.0, &ws_event);

    // Notify the user to refresh their chat list (since last message preview changes)
    let update_msg = json!({
        "type": "chat_list_update",
        "chat_id": chat_id
    }).to_string();
    call_manager.send_to_user(auth.0, &update_msg);

    Ok(Json(json!({ "status": "success", "chat_id": chat_id })))
}

