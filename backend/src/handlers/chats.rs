use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::auth::AuthUser;
use crate::models::chat::ChatListItem;

#[derive(Debug, Deserialize)]
pub struct CreateChatRequest {
    pub participant_id: Uuid,
}

pub async fn create_chat(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateChatRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.participant_id == auth.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "cannot create chat with yourself" })),
        ));
    }

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT c.id FROM chats c
         JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
         JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = $2
         LIMIT 1",
    )
    .bind(auth.0)
    .bind(body.participant_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if let Some((chat_id,)) = existing {
        return Ok(Json(json!({ "id": chat_id, "already_exists": true })));
    }

    let chat_id = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO chats DEFAULT VALUES RETURNING id",
    )
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create chat" })),
        )
    })?;

    sqlx::query("INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)")
        .bind(chat_id.0)
        .bind(auth.0)
        .bind(body.participant_id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to add participants" })),
            )
        })?;

    Ok(Json(json!({ "id": chat_id.0, "already_exists": false })))
}

#[derive(Debug, Deserialize)]
pub struct ListChatsQuery {
    pub chat_id: Option<Uuid>,
}

pub async fn list_chats(
    State(pool): State<PgPool>,
    axum::extract::Query(query): axum::extract::Query<ListChatsQuery>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let chats = sqlx::query_as::<_, ChatListItem>(
        r#"WITH users_in_chat AS (
            SELECT chat_id, jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username)) AS users
            FROM chat_participants cp
            JOIN users u ON u.id = cp.user_id
            GROUP BY chat_id
        )
        SELECT
            c.id,
            (SELECT u2.id FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) AS participant_id,
            (SELECT u2.username FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) AS participant_username,
            (SELECT u2.avatar_url FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) AS participant_avatar_url,
            c.is_group,
            c.name,
            CASE
                WHEN cal.created_at IS NOT NULL AND (m.created_at IS NULL OR cal.created_at > m.created_at) THEN
                    CASE
                        WHEN cal.caller_id = $1 THEN 'Chamada efetuada'
                        ELSE 
                            CASE 
                                WHEN cal.status = 'completed' THEN 'Chamada recebida'
                                ELSE 'Chamada perdida'
                            END
                    END
                WHEN m.created_at IS NOT NULL THEN
                    CASE
                        WHEN m.deleted_for_everyone = TRUE THEN 'Message deleted'
                        WHEN m.image_url IS NOT NULL AND TRIM(m.image_url) != '' AND (m.image_url ~* 'audio' OR m.image_url ~* '\.(m4a|mp3|wav|caf|ogg|3gp|opus)(\?.*)?$') THEN
                            CASE
                                WHEN m.content IS NOT NULL AND m.content LIKE 'duration:%' THEN 'Audio|' || m.content
                                ELSE 'Audio'
                            END
                        WHEN m.content IS NOT NULL AND TRIM(m.content) != '' THEN m.content
                        WHEN m.image_url IS NOT NULL AND TRIM(m.image_url) != '' THEN
                            CASE
                                WHEN m.image_url ~* '\.(jpg|jpeg|png|gif|webp)(\?.*)?$' THEN 'Photo'
                                WHEN m.image_url ~* '\.(mp4|mov|webm|mkv|avi)(\?.*)?$' AND NOT m.image_url ~* 'audio' THEN 'Video'
                                ELSE 'File|' || COALESCE(substring(split_part(m.image_url, '?', 1) from '[^/]+$'), 'File')
                            END
                        ELSE NULL
                    END
                ELSE NULL
            END AS last_message,
            CASE
                WHEN cal.created_at IS NOT NULL AND (m.created_at IS NULL OR cal.created_at > m.created_at) THEN cal.created_at
                ELSE m.created_at
            END AS last_message_at,
            c.created_at,
            (
                SELECT COALESCE(COUNT(*), 0) FROM messages msg
                WHERE msg.chat_id = c.id
                  AND msg.sender_id != $1
                  AND msg.created_at > cp1.last_read_at
                  AND (cp1.cleared_at IS NULL OR msg.created_at > cp1.cleared_at)
            ) AS unread_count,
            (
                SELECT COALESCE(
                    (SELECT con.is_blocked FROM contacts con WHERE con.user_id = $1 AND con.contact_id = (
                        SELECT cp2.user_id FROM chat_participants cp2 WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1
                    )),
                    false
                )
            ) AS is_blocked_by_me,
            (
                SELECT COALESCE(
                    (SELECT con.is_blocked FROM contacts con WHERE con.user_id = (
                        SELECT cp2.user_id FROM chat_participants cp2 WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1
                    ) AND con.contact_id = $1),
                    false
                )
            ) AS is_blocked_by_them,
            cp1.cleared_at,
            cp1.notification_muted_until,
            cp1.notification_muted_forever
         FROM chats c
         JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
         LEFT JOIN LATERAL (
             SELECT u2.id AS p_id FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1
         ) p ON true
         LEFT JOIN LATERAL (
             SELECT caller_id, callee_id, status, created_at FROM call_logs
             WHERE c.is_group = false 
               AND p.p_id IS NOT NULL 
               AND ((caller_id = $1 AND callee_id = p.p_id) OR (caller_id = p.p_id AND callee_id = $1))
               AND (cp1.cleared_at IS NULL OR created_at > cp1.cleared_at)
             ORDER BY created_at DESC
             LIMIT 1
         ) cal ON true
         LEFT JOIN LATERAL (
             SELECT content, image_url, deleted_for_everyone, created_at FROM messages
             WHERE chat_id = c.id AND (cp1.cleared_at IS NULL OR created_at > cp1.cleared_at)
             ORDER BY created_at DESC
             LIMIT 1
         ) m ON true
         WHERE cp1.cleared_at IS NULL OR m.created_at IS NOT NULL OR cal.created_at IS NOT NULL OR c.id = $2
         ORDER BY COALESCE(
             CASE
                 WHEN cal.created_at IS NOT NULL AND (m.created_at IS NULL OR cal.created_at > m.created_at) THEN cal.created_at
                 ELSE m.created_at
             END,
             c.created_at
         ) DESC NULLS LAST"#,
    )
    .bind(auth.0)
    .bind(query.chat_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    Ok(Json(json!({ "chats": chats })))
}

pub async fn delete_chat(
    State(pool): State<PgPool>,
    State(_ws_state): State<crate::ws::WsState>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    axum::extract::Path(chat_id): axum::extract::Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // 1. Verify participant
    let is_participant: Option<(Uuid,)> = sqlx::query_as(
        "SELECT chat_id FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    if is_participant.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a participant of this chat" })),
        ));
    }

    // 2. Set cleared_at = NOW() for the requesting user in chat_participants
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

    // 3. Notify current user's websocket connections to refresh chat list
    let update_msg = json!({
        "type": "chat_list_update",
        "chat_id": chat_id
    }).to_string();
    call_manager.send_to_user(auth.0, &update_msg);

    Ok(Json(json!({ "status": "success", "chat_id": chat_id })))
}

#[derive(Debug, Deserialize)]
pub struct MuteChatPayload {
    pub muted_until: Option<DateTime<Utc>>,
    pub muted_forever: bool,
}

pub async fn mute_chat(
    State(pool): State<PgPool>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    axum::extract::Path(chat_id): axum::extract::Path<Uuid>,
    Json(payload): Json<MuteChatPayload>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // 1. Verify participant
    let is_participant: Option<(Uuid,)> = sqlx::query_as(
        "SELECT chat_id FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
    )
    .bind(chat_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    if is_participant.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a participant of this chat" })),
        ));
    }

    // 2. Update mute settings in chat_participants
    sqlx::query(
        "UPDATE chat_participants \
         SET notification_muted_until = $1, notification_muted_forever = $2 \
         WHERE chat_id = $3 AND user_id = $4"
    )
    .bind(payload.muted_until)
    .bind(payload.muted_forever)
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

    // 3. Notify user's websocket connections to refresh chat list
    let update_msg = json!({
        "type": "chat_list_update",
        "chat_id": chat_id
    }).to_string();
    call_manager.send_to_user(auth.0, &update_msg);

    Ok(Json(json!({ "status": "success", "chat_id": chat_id })))
}

