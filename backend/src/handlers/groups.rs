use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub participant_ids: Vec<Uuid>,
}

pub async fn create_group(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateGroupRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "group name is required" })),
        ));
    }

    if body.participant_ids.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "at least one participant is required" })),
        ));
    }

    for pid in &body.participant_ids {
        if *pid == auth.0 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "cannot add yourself as participant" })),
            ));
        }
    }

    let chat_id = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO chats (is_group, name, created_by) VALUES (true, $1, $2) RETURNING id",
    )
    .bind(&body.name)
    .bind(auth.0)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create group" })),
        )
    })?;

    let mut all_ids = vec![auth.0];
    all_ids.extend(&body.participant_ids);

    for uid in &all_ids {
        sqlx::query("INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
            .bind(chat_id.0)
            .bind(uid)
            .execute(&pool)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "failed to add participant" })),
                )
            })?;
    }

    Ok(Json(json!({ "id": chat_id.0, "name": body.name })))
}

pub async fn add_participant(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = body.get("user_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "user_id is required" })),
        )
    })?;

    let chat: Option<(bool, Uuid)> = sqlx::query_as(
        "SELECT is_group, created_by FROM chats WHERE id = $1",
    )
    .bind(chat_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    match chat {
        Some((true, created_by)) if created_by == auth.0 => {
            sqlx::query("INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
                .bind(chat_id)
                .bind(user_id)
                .execute(&pool)
                .await
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "failed to add participant" })),
                    )
                })?;

            Ok(Json(json!({ "status": "ok" })))
        }
        Some((true, _)) => Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the group creator can add participants" })),
        )),
        Some((false, _)) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "cannot add participants to a non-group chat" })),
        )),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "chat not found" })),
        )),
    }
}

pub async fn remove_participant(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((chat_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let chat: Option<(bool, Uuid)> = sqlx::query_as(
        "SELECT is_group, created_by FROM chats WHERE id = $1",
    )
    .bind(chat_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    match chat {
        Some((true, created_by)) if created_by == auth.0 || user_id == auth.0 => {
            if user_id == created_by {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "creator cannot be removed" })),
                ));
            }

            sqlx::query("DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2")
                .bind(chat_id)
                .bind(user_id)
                .execute(&pool)
                .await
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "failed to remove participant" })),
                    )
                })?;

            Ok(Json(json!({ "status": "ok" })))
        }
        Some((true, _)) => Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the group creator can remove participants" })),
        )),
        Some((false, _)) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "not a group chat" })),
        )),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "chat not found" })),
        )),
    }
}

#[derive(Debug, serde::Serialize, sqlx::FromRow)]
pub struct GroupParticipant {
    pub id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, serde::Serialize)]
pub struct GroupDetailsResponse {
    pub id: Uuid,
    pub name: Option<String>,
    pub created_by: Option<Uuid>,
    pub is_group: bool,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub participants: Vec<GroupParticipant>,
}

pub async fn get_group_details(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
) -> Result<Json<GroupDetailsResponse>, (StatusCode, Json<Value>)> {
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

    let chat: Option<(Option<String>, Option<Uuid>, bool, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT name, created_by, is_group, avatar_url, description FROM chats WHERE id = $1",
    )
    .bind(chat_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    let (name, created_by, is_group, avatar_url, description) = chat.ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "chat not found" })),
        )
    })?;

    let participants = sqlx::query_as::<_, GroupParticipant>(
        "SELECT u.id, u.username, u.avatar_url, u.name 
         FROM chat_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.chat_id = $1",
    )
    .bind(chat_id)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error fetching participants" })),
        )
    })?;

    Ok(Json(GroupDetailsResponse {
        id: chat_id,
        name,
        created_by,
        is_group,
        avatar_url,
        description,
        participants,
    }))
}

#[derive(Debug, Deserialize)]
pub struct UpdateGroupRequest {
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
}

pub async fn update_group(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(chat_id): Path<Uuid>,
    Json(body): Json<UpdateGroupRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let chat: Option<(bool, Option<Uuid>)> = sqlx::query_as(
        "SELECT is_group, created_by FROM chats WHERE id = $1",
    )
    .bind(chat_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    match chat {
        Some((true, Some(created_by))) if created_by == auth.0 => {
            if let Some(name) = body.name {
                if name.trim().is_empty() {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(json!({ "error": "group name cannot be empty" })),
                    ));
                }
                sqlx::query("UPDATE chats SET name = $1 WHERE id = $2")
                    .bind(name)
                    .bind(chat_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": format!("failed to update name: {}", e) })),
                        )
                    })?;
            }

            if let Some(avatar_url) = body.avatar_url {
                let val = if avatar_url.trim().is_empty() {
                    None
                } else {
                    Some(avatar_url)
                };
                sqlx::query("UPDATE chats SET avatar_url = $1 WHERE id = $2")
                    .bind(val)
                    .bind(chat_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": format!("failed to update avatar: {}", e) })),
                        )
                    })?;
            }

            if let Some(description) = body.description {
                let val = if description.trim().is_empty() {
                    None
                } else {
                    Some(description)
                };
                sqlx::query("UPDATE chats SET description = $1 WHERE id = $2")
                    .bind(val)
                    .bind(chat_id)
                    .execute(&pool)
                    .await
                    .map_err(|e| {
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({ "error": format!("failed to update description: {}", e) })),
                        )
                    })?;
            }

            // Fetch updated chat to return
            let updated: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT name, avatar_url, description FROM chats WHERE id = $1",
            )
            .bind(chat_id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;

            if let Some((name, avatar_url, description)) = updated {
                Ok(Json(json!({
                    "status": "ok",
                    "name": name,
                    "avatar_url": avatar_url,
                    "description": description
                })))
            } else {
                Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "failed to retrieve updated group details" })),
                ))
            }
        }
        Some((true, _)) => Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the group creator can update group details" })),
        )),
        Some((false, _)) => Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "not a group chat" })),
        )),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "chat not found" })),
        )),
    }
}

