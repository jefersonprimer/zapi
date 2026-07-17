use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth;

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub about: Option<String>,
    pub name: Option<String>,
    pub privacy_messages: String,
    pub privacy_calls: String,
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<Value>)> {
    if body.username.trim().is_empty()
        || body.email.trim().is_empty()
        || body.password.is_empty()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "username, email and password are required" })),
        ));
    }

    crate::auth::validate_username(&body.username).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e })),
        )
    })?;

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to hash password" })),
            )
        })?
        .to_string();

    let user = sqlx::query_as::<_, crate::models::user::User>(
        "INSERT INTO users (username, email, password_hash, name) VALUES ($1, $2, $3, $1) RETURNING id, username, email, password_hash, created_at, avatar_url, about, name, username_updated_at, privacy_messages, privacy_calls",
    )
    .bind(&body.username)
    .bind(&body.email)
    .bind(&password_hash)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        let msg = if e.to_string().contains("duplicate key") {
            "username or email already exists"
        } else {
            "failed to create user"
        };
        (
            StatusCode::CONFLICT,
            Json(json!({ "error": msg })),
        )
    })?;

    // Create a publisher for the new user
    let publisher_name = user.name.clone().unwrap_or(user.username.clone());
    let _ = sqlx::query(
        "INSERT INTO publishers (type, ref_id, name, avatar_url) VALUES ('user', $1, $2, $3) ON CONFLICT (type, ref_id) DO NOTHING",
    )
    .bind(user.id)
    .bind(&publisher_name)
    .bind(&user.avatar_url)
    .execute(&pool)
    .await;

    let token = auth::create_token(user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create token" })),
        )
    })?;

    Ok(Json(AuthResponse {
        token,
        user_id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        about: user.about,
        name: user.name,
        privacy_messages: user.privacy_messages,
        privacy_calls: user.privacy_calls,
    }))
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<Value>)> {
    let user = sqlx::query_as::<_, crate::models::user::User>(
        "SELECT id, username, email, password_hash, created_at, avatar_url, about, name, username_updated_at, privacy_messages, privacy_calls FROM users WHERE email = $1",
    )
    .bind(&body.email)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "invalid email or password" })),
        )
    })?;

    let parsed_hash = PasswordHash::new(&user.password_hash).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "invalid password hash" })),
        )
    })?;

    Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "invalid email or password" })),
            )
        })?;

    let token = auth::create_token(user.id).map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create token" })),
        )
    })?;

    Ok(Json(AuthResponse {
        token,
        user_id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        about: user.about,
        name: user.name,
        privacy_messages: user.privacy_messages,
        privacy_calls: user.privacy_calls,
    }))
}
