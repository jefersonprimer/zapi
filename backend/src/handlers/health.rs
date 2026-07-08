use axum::{extract::State, http::StatusCode, Json};
use serde_json::{json, Value};
use sqlx::PgPool;

pub async fn health_check(State(pool): State<PgPool>) -> (StatusCode, Json<Value>) {
    let db_ok = sqlx::query("SELECT 1").execute(&pool).await.is_ok();

    if db_ok {
        (
            StatusCode::OK,
            Json(json!({ "status": "healthy", "database": "connected" })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "status": "unhealthy", "database": "disconnected" })),
        )
    }
}
