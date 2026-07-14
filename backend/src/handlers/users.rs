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
    pub name: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateProfileRequest {
    pub avatar_url: Option<String>,
    pub keep_chats_archived: Option<bool>,
    pub about: Option<String>,
    pub name: Option<String>,
    pub username: Option<String>,
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

    let clean_q = q.strip_prefix('@').unwrap_or(q);
    let pattern = format!("%{}%", clean_q);

    let users = sqlx::query_as::<_, (Uuid, String, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, username, email, avatar_url, about, name FROM users WHERE (username ILIKE $1 OR email ILIKE $1 OR name ILIKE $1) AND id != $2 LIMIT 20",
    )
    .bind(&pattern)
    .bind(auth.0)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    let results: Vec<UserSearchResult> = users
        .into_iter()
        .map(|(id, username, email, avatar_url, about, name)| UserSearchResult {
            id,
            username,
            email,
            avatar_url,
            about,
            name,
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
        && body.name.is_none()
        && body.username.is_none()
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

    if let Some(ref name) = body.name {
        if name.chars().count() > 100 {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Name must be at most 100 characters" })),
            ));
        }
        let name_value = if name.trim().is_empty() {
            None
        } else {
            Some(name.as_str())
        };
        sqlx::query("UPDATE users SET name = $1 WHERE id = $2")
            .bind(name_value)
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

    if let Some(ref new_username) = body.username {
        let trimmed_username = new_username.trim().to_string();
        if trimmed_username.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Username cannot be empty" })),
            ));
        }

        crate::auth::validate_username(&trimmed_username).map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": e })),
            )
        })?;

        let current_user = sqlx::query!("SELECT username, username_updated_at FROM users WHERE id = $1", auth.0)
            .fetch_one(&pool)
            .await
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": format!("database error: {}", e) })),
                )
            })?;

        if current_user.username != trimmed_username {
            if let Some(last_updated) = current_user.username_updated_at {
                let now = chrono::Utc::now();
                let diff = now.signed_duration_since(last_updated);
                if diff.num_days() < 30 {
                    let days_left = 30 - diff.num_days();
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(json!({
                            "error": format!("You can only change your username once every 30 days. Try again in {} days.", days_left)
                        })),
                    ));
                }
            }

            sqlx::query("UPDATE users SET username = $1, username_updated_at = NOW() WHERE id = $2")
                .bind(&trimmed_username)
                .bind(auth.0)
                .execute(&pool)
                .await
                .map_err(|e| {
                    let msg = if e.to_string().contains("duplicate key") {
                        "username already exists"
                    } else {
                        "failed to update username"
                    };
                    (
                        StatusCode::CONFLICT,
                        Json(json!({ "error": msg })),
                    )
                })?;
        }
    }

    let updated_user = sqlx::query!(
        "SELECT username, email, avatar_url, about, name FROM users WHERE id = $1",
        auth.0
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("database error: {}", e) })),
        )
    })?;

    Ok(Json(json!({
        "status": "success",
        "username": updated_user.username,
        "email": updated_user.email,
        "avatar_url": updated_user.avatar_url,
        "about": updated_user.about,
        "name": updated_user.name,
    })))
}
