use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::auth::AuthUser;

#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub token: String,
}

pub async fn register_push_token(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<RegisterPushTokenRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.token.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "token is required" })),
        ));
    }

    sqlx::query(
        "INSERT INTO push_tokens (user_id, token) VALUES ($1, $2) ON CONFLICT (user_id, token) DO NOTHING",
    )
    .bind(auth.0)
    .bind(&body.token)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to register push token" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok" })))
}
