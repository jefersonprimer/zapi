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

    // Check recipient's privacy settings for messages
    let recipient_privacy: Option<(String, bool)> = sqlx::query_as(
        r#"
        SELECT privacy_messages,
               EXISTS(SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2) AS is_contact
        FROM users
        WHERE id = $1
        "#
    )
    .bind(body.participant_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

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

    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT c.id FROM chats c
         JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
         JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = $2
         WHERE c.is_group = false
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
            (SELECT u2.name FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) AS participant_name,
            (SELECT s.id FROM stores s WHERE s.owner_id = (SELECT cp2.user_id FROM chat_participants cp2 WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) LIMIT 1) AS participant_store_id,
            c.is_group,
            c.name,
            c.avatar_url,
            c.description,
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
            (
                CASE
                    WHEN c.is_group THEN NULL
                    ELSE (
                        SELECT
                            CASE
                                WHEN u.privacy_messages = 'nobody' THEN 'nobody'
                                WHEN u.privacy_messages = 'contacts'
                                     AND NOT EXISTS (
                                         SELECT 1 FROM contacts con
                                         WHERE con.user_id = u.id AND con.contact_id = $1
                                     )
                                THEN 'contacts'
                                ELSE NULL
                            END
                        FROM users u
                        WHERE u.id = (
                            SELECT cp2.user_id FROM chat_participants cp2
                            WHERE cp2.chat_id = c.id AND cp2.user_id != $1
                            LIMIT 1
                        )
                    )
                END
            ) AS messages_restricted_reason,
            cp1.cleared_at,
            cp1.notification_muted_until,
            cp1.notification_muted_forever,
            cp1.is_archived,
            cp1.is_favorite
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

#[derive(Debug, Deserialize)]
pub struct ArchiveChatPayload {
    pub is_archived: bool,
}

pub async fn archive_chat(
    State(pool): State<PgPool>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    axum::extract::Path(chat_id): axum::extract::Path<Uuid>,
    Json(payload): Json<ArchiveChatPayload>,
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

    // 2. Update archive setting in chat_participants
    sqlx::query(
        "UPDATE chat_participants \
         SET is_archived = $1 \
         WHERE chat_id = $2 AND user_id = $3"
    )
    .bind(payload.is_archived)
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

    Ok(Json(json!({ "status": "success", "chat_id": chat_id, "is_archived": payload.is_archived })))
}

#[derive(Debug, Deserialize)]
pub struct FavoriteChatPayload {
    pub is_favorite: bool,
}

pub async fn favorite_chat(
    State(pool): State<PgPool>,
    State(call_manager): State<crate::signaling::CallManager>,
    auth: AuthUser,
    axum::extract::Path(chat_id): axum::extract::Path<Uuid>,
    Json(payload): Json<FavoriteChatPayload>,
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

    // 2. Update favorite settings in chat_participants
    sqlx::query(
        "UPDATE chat_participants \
         SET is_favorite = $1 \
         WHERE chat_id = $2 AND user_id = $3"
    )
    .bind(payload.is_favorite)
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

    Ok(Json(json!({ "status": "success", "chat_id": chat_id, "is_favorite": payload.is_favorite })))
}

#[derive(Debug, Deserialize, serde::Serialize, sqlx::FromRow)]
pub struct ChatList {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, serde::Serialize)]
pub struct ChatListResponse {
    #[serde(flatten)]
    pub list: ChatList,
    pub chat_ids: Vec<Uuid>,
}

pub async fn list_chat_lists(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let lists = sqlx::query_as::<_, ChatList>(
        "SELECT * FROM chat_lists WHERE user_id = $1 ORDER BY position ASC, created_at ASC"
    )
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    let mut response = Vec::new();
    for list in lists {
        let chat_ids = sqlx::query_scalar::<_, Uuid>(
            "SELECT chat_id FROM chat_list_items WHERE list_id = $1"
        )
        .bind(list.id)
        .fetch_all(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
        })?;

        response.push(ChatListResponse { list, chat_ids });
    }

    Ok(Json(json!({ "lists": response })))
}

#[derive(Debug, Deserialize)]
pub struct CreateChatListRequest {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

pub async fn create_chat_list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(payload): Json<CreateChatListRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let new_list = sqlx::query_as::<_, ChatList>(
        "INSERT INTO chat_lists (user_id, name, color, icon) \
         VALUES ($1, $2, $3, $4) \
         RETURNING *"
    )
    .bind(auth.0)
    .bind(payload.name)
    .bind(payload.color)
    .bind(payload.icon)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(json!({ "list": new_list, "chat_ids": Vec::<Uuid>::new() })))
}

pub async fn delete_chat_list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    axum::extract::Path(list_id): axum::extract::Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let deleted = sqlx::query(
        "DELETE FROM chat_lists WHERE id = $1 AND user_id = $2"
    )
    .bind(list_id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    if deleted.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "list not found or not owned by user" })),
        ));
    }

    Ok(Json(json!({ "status": "success", "id": list_id })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateChatListsMembershipRequest {
    pub list_ids: Vec<Uuid>,
}

pub async fn update_chat_lists_membership(
    State(pool): State<PgPool>,
    auth: AuthUser,
    axum::extract::Path(chat_id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateChatListsMembershipRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // 1. Check if user is a participant of the chat
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

    // 2. Validate that all list_ids belong to the user
    for list_id in &payload.list_ids {
        let is_owner: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM chat_lists WHERE id = $1 AND user_id = $2"
        )
        .bind(list_id)
        .bind(auth.0)
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
        })?;

        if is_owner.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("list {} not found or not owned by user", list_id) })),
            ));
        }
    }

    // 3. Clear existing list memberships for this chat for the user's lists
    sqlx::query(
        "DELETE FROM chat_list_items \
         WHERE chat_id = $1 AND list_id IN (SELECT id FROM chat_lists WHERE user_id = $2)"
    )
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

    // 4. Insert new memberships
    for list_id in &payload.list_ids {
        sqlx::query(
            "INSERT INTO chat_list_items (list_id, chat_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(list_id)
        .bind(chat_id)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
        })?;
    }

    Ok(Json(json!({ "status": "success", "chat_id": chat_id, "list_ids": payload.list_ids })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateChatListRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub position: Option<i32>,
}

pub async fn update_chat_list(
    State(pool): State<PgPool>,
    auth: AuthUser,
    axum::extract::Path(list_id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateChatListRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // 1. Verify ownership
    let is_owner: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM chat_lists WHERE id = $1 AND user_id = $2"
    )
    .bind(list_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    if is_owner.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you do not own this list" })),
        ));
    }

    // 2. Update list
    sqlx::query(
        "UPDATE chat_lists \
         SET name = COALESCE($1, name), color = COALESCE($2, color), icon = COALESCE($3, icon), position = COALESCE($4, position), updated_at = NOW() \
         WHERE id = $5"
    )
    .bind(payload.name)
    .bind(payload.color)
    .bind(payload.icon)
    .bind(payload.position)
    .bind(list_id)
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(json!({ "status": "success", "id": list_id })))
}


