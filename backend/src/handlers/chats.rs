use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

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

pub async fn list_chats(
    State(pool): State<PgPool>,
    auth: AuthUser,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let chats = sqlx::query_as::<_, ChatListItem>(
        "WITH users_in_chat AS (
            SELECT chat_id, jsonb_agg(jsonb_build_object('id', u.id, 'username', u.username)) AS users
            FROM chat_participants cp
            JOIN users u ON u.id = cp.user_id
            GROUP BY chat_id
        )
        SELECT
            c.id,
            (SELECT u2.id FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) AS participant_id,
            (SELECT u2.username FROM chat_participants cp2 JOIN users u2 ON u2.id = cp2.user_id WHERE cp2.chat_id = c.id AND cp2.user_id != $1 LIMIT 1) AS participant_username,
            c.is_group,
            c.name,
            m.content AS last_message,
            m.created_at AS last_message_at,
            c.created_at
         FROM chats c
         JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
         LEFT JOIN LATERAL (
             SELECT content, created_at FROM messages
             WHERE chat_id = c.id
             ORDER BY created_at DESC
             LIMIT 1
         ) m ON true
         ORDER BY m.created_at DESC NULLS LAST",
    )
    .bind(auth.0)
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
