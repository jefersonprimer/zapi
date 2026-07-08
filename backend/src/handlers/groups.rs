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
