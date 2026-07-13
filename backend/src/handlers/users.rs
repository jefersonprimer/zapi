use axum::{extract::State, http::StatusCode, Json};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;

const ABOUT_MAX_LEN: usize = 139;

#[derive(Debug, Serialize)]
pub struct UserSearchResult {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub about: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateProfileRequest {
    pub avatar_url: Option<String>,
    pub keep_chats_archived: Option<bool>,
    pub about: Option<String>,
}

pub async fn search_users(
    State(pool): State<PgPool>,
    auth: AuthUser,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let q = params.get("q").map(|s| s.trim()).unwrap_or("");

    if q.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "query parameter 'q' is required" })),
        ));
    }

    let pattern = format!("%{}%", q);

    let users = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<String>)>(
        "SELECT id, username, email, avatar_url, about FROM users WHERE (username ILIKE $1 OR email ILIKE $1) AND id != $2 LIMIT 20",
    )
    .bind(&pattern)
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    let results: Vec<UserSearchResult> = users
        .into_iter()
        .map(|(id, username, email, avatar_url, about)| UserSearchResult {
            id,
            username,
            email,
            avatar_url,
            about,
        })
        .collect();

    Ok(Json(json!({ "users": results })))
}

pub async fn update_profile(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if let Some(ref avatar) = body.avatar_url {
        sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
            .bind(avatar)
            .bind(auth.0)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    } else if body.avatar_url.is_none()
        && body.keep_chats_archived.is_none()
        && body.about.is_none()
    {
        // original behavior of setting avatar to NULL if only avatar is None
        sqlx::query("UPDATE users SET avatar_url = NULL WHERE id = $1")
            .bind(auth.0)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    }

    if let Some(keep_archived) = body.keep_chats_archived {
        sqlx::query("UPDATE users SET keep_chats_archived = $1 WHERE id = $2")
            .bind(keep_archived)
            .bind(auth.0)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    }

    if let Some(ref about) = body.about {
        if about.chars().count() > ABOUT_MAX_LEN {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("about must be at most {} characters", ABOUT_MAX_LEN) })),
            ));
        }
        let about_value = if about.trim().is_empty() {
            None
        } else {
            Some(about.as_str())
        };
        sqlx::query("UPDATE users SET about = $1 WHERE id = $2")
            .bind(about_value)
            .bind(auth.0)
            .execute(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;
    }

    Ok(Json(json!({
        "status": "success",
        "avatar_url": body.avatar_url,
        "keep_chats_archived": body.keep_chats_archived,
        "about": body.about,
    })))
}
