use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;
use crate::signaling::CallState;
use crate::models::call::CallHistoryResponse;
use crate::signaling::types::WsMessage;

#[derive(Debug, Deserialize)]
pub struct StartCallRequest {
    pub target_user_id: Uuid,
    pub is_video: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct EndCallRequest {
    pub call_id: Uuid,
}

pub async fn start_call(
    AuthUser(caller_id): AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<StartCallRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let callee_id = payload.target_user_id;

    // Start in memory
    let call_id = state.call_manager.start_call(caller_id, callee_id).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e })),
        )
    })?;

    // Fetch caller's username
    let caller_username = sqlx::query_scalar::<_, String>(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(caller_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or_else(|_| "Unknown User".to_string());

    // Attempt to notify callee immediately over WS
    let incoming_msg = serde_json::to_string(&WsMessage::CallStart {
        call_id: Some(call_id),
        target_user_id: caller_id,
        caller_username: Some(caller_username),
        is_video: payload.is_video,
    }).unwrap();

    // Bob gets incoming call containing the caller's details
    // We send CallStart to Bob's socket.
    // If Bob is offline, Bob's peer check returns false.
    let notified = state.call_manager.send_to_user(callee_id, &incoming_msg);
    if !notified {
        // Callee offline
        state.call_manager.terminate_call(call_id, "callee offline").ok();
        
        // Log missed call directly to DB since Bob is offline
        let pool: PgPool = state.pool.clone();
        tokio::spawn(async move {
            sqlx::query(
                "INSERT INTO call_logs (caller_id, callee_id, status, duration) VALUES ($1, $2, $3, $4)"
            )
            .bind(caller_id)
            .bind(callee_id)
            .bind("missed")
            .bind(0)
            .execute(&pool)
            .await
            .ok();
        });

        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Recipient is offline" })),
        ));
    }

    Ok((StatusCode::CREATED, Json(json!({ "call_id": call_id }))))
}

pub async fn end_call(
    AuthUser(user_id): AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<EndCallRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let call_id = payload.call_id;

    // End call in memory
    let active_call = state.call_manager.end_call(call_id, user_id).map_err(|e| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": e })),
        )
    })?;

    let duration = (Utc::now() - active_call.created_at).num_seconds() as i32;
    let status = match active_call.state {
        CallState::Connected => "completed",
        CallState::Calling | CallState::Ringing | CallState::Connecting => "missed",
        CallState::Rejected => "rejected",
        CallState::Busy => "busy",
        _ => "failed",
    };

    // Save to Database
    let pool = state.pool.clone();
    let caller_id = active_call.caller_id;
    let callee_id = active_call.callee_id;
    let status_str = status.to_string();

    tokio::spawn(async move {
        sqlx::query(
            "INSERT INTO call_logs (caller_id, callee_id, status, duration, created_at) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(caller_id)
        .bind(callee_id)
        .bind(status_str)
        .bind(duration)
        .bind(active_call.created_at)
        .execute(&pool)
        .await
        .ok();
    });

    // Notify other participant that the call ended
    let other_id = if user_id == caller_id { callee_id } else { caller_id };
    let end_msg = serde_json::to_string(&WsMessage::CallEnded { call_id }).unwrap();
    state.call_manager.send_to_user(other_id, &end_msg);

    Ok(Json(json!({
        "status": "success",
        "duration": duration,
        "call_status": status
    })))
}

pub async fn get_history(
    AuthUser(user_id): AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let logs = sqlx::query_as::<_, CallHistoryResponse>(
        r#"
        SELECT 
            c.id, 
            c.caller_id, 
            u1.username as caller_username, 
            c.callee_id, 
            u2.username as callee_username, 
            c.status, 
            c.duration, 
            c.created_at
        FROM call_logs c
        JOIN users u1 ON c.caller_id = u1.id
        JOIN users u2 ON c.callee_id = u2.id
        WHERE c.caller_id = $1 OR c.callee_id = $1
        ORDER BY c.created_at DESC
        LIMIT 50
        "#,
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    Ok(Json(logs))
}
