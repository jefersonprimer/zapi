use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;

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

    // Check if caller is blocked by callee or if callee has call privacy settings
    let callee_privacy: Option<(String, bool, bool)> = sqlx::query_as(
        r#"
        SELECT u.privacy_calls,
               EXISTS(SELECT 1 FROM contacts con WHERE con.user_id = $1 AND con.contact_id = $2) AS is_contact,
               EXISTS(SELECT 1 FROM contacts con WHERE con.user_id = $1 AND con.contact_id = $2 AND con.is_blocked = true) AS is_blocked
        FROM users u
        WHERE u.id = $1
        "#
    )
    .bind(callee_id)
    .bind(caller_id)
    .fetch_optional(&state.pool)
    .await
    .unwrap_or(None);

    if let Some((privacy, is_contact, is_blocked)) = callee_privacy {
        if is_blocked {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "call_blocked",
                    "message": "Não é possível realizar a chamada. Você foi bloqueado por este usuário."
                })),
            ));
        }

        if privacy == "nobody" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "privacy_calls_nobody",
                    "message": "Este usuário não recebe ligações."
                })),
            ));
        } else if privacy == "contacts" && !is_contact {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({
                    "error": "privacy_calls_contacts",
                    "message": "Este usuário recebe ligações apenas de contatos."
                })),
            ));
        }
    }

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
        caller_username: Some(caller_username.clone()),
        is_video: payload.is_video,
    }).unwrap();

    // Bob gets incoming call containing the caller's details
    // We send CallStart to Bob's socket.
    // If Bob is offline, Bob's peer check returns false.
    let notified = state.call_manager.send_to_user(callee_id, &incoming_msg);
    if !notified {
        // Recipient is offline. Send a high-priority push notification instead of terminating!
        let pool = state.pool.clone();
        let caller_username_clone = caller_username.clone();
        let is_video = payload.is_video.unwrap_or(false);
        tokio::spawn(async move {
            crate::push::send_call_push_notification(
                &pool,
                callee_id,
                &caller_username_clone,
                call_id,
                caller_id,
                is_video,
            )
            .await;
        });
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
    let call_manager = state.call_manager.clone();
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

        // Notify participants of chat update
        let chat_id: Option<(Uuid,)> = sqlx::query_as(
            "SELECT c.id FROM chats c
             JOIN chat_participants cp1 ON cp1.chat_id = c.id AND cp1.user_id = $1
             JOIN chat_participants cp2 ON cp2.chat_id = c.id AND cp2.user_id = $2
             WHERE c.is_group = false
             LIMIT 1"
        )
        .bind(caller_id)
        .bind(callee_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or_default();

        if let Some((cid,)) = chat_id {
            let update_msg = serde_json::json!({
                "type": "chat_list_update",
                "chat_id": cid
            }).to_string();
            call_manager.send_to_user(caller_id, &update_msg);
            call_manager.send_to_user(callee_id, &update_msg);
        }
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
        WHERE (c.caller_id = $1 AND c.deleted_by_caller = FALSE)
           OR (c.callee_id = $1 AND c.deleted_by_callee = FALSE)
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

pub async fn delete_call(
    AuthUser(user_id): AuthUser,
    State(state): State<AppState>,
    axum::extract::Path(call_id): axum::extract::Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<serde_json::Value>)> {
    let result = sqlx::query(
        r#"
        UPDATE call_logs
        SET 
            deleted_by_caller = CASE WHEN caller_id = $2 THEN TRUE ELSE deleted_by_caller END,
            deleted_by_callee = CASE WHEN callee_id = $2 THEN TRUE ELSE deleted_by_callee END
        WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
        "#,
    )
    .bind(call_id)
    .bind(user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Call log not found or unauthorized" })),
        ));
    }

    // Hard delete call log record if both caller and callee have deleted it
    let _ = sqlx::query(
        r#"
        DELETE FROM call_logs
        WHERE id = $1 AND deleted_by_caller = TRUE AND deleted_by_callee = TRUE
        "#,
    )
    .bind(call_id)
    .execute(&state.pool)
    .await;

    Ok(Json(json!({ "status": "success" })))
}
