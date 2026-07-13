use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;

use crate::auth::AuthUser;

#[derive(Debug, Deserialize)]
pub struct RegisterPushTokenRequest {
    pub token: String,
    pub platform: Option<String>,
    pub device_name: Option<String>,
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

    let platform = body.platform.as_deref().unwrap_or("android");
    let device_name = body.device_name.as_deref().unwrap_or("Device");

    sqlx::query(
        "INSERT INTO device_tokens (user_id, token, platform, device_name, last_seen_at) \
         VALUES ($1, $2, $3, $4, NOW()) \
         ON CONFLICT (token) DO UPDATE SET last_seen_at = NOW(), device_name = EXCLUDED.device_name, platform = EXCLUDED.platform",
    )
    .bind(auth.0)
    .bind(&body.token)
    .bind(platform)
    .bind(device_name)
    .execute(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to register device token: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to register push token" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok" })))
}
