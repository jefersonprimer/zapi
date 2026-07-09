use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth;
use crate::AppState;
use crate::signaling::{CallState, WsMessage};

#[derive(Debug, Deserialize)]
pub(crate) struct WsQuery {
    token: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let claims = auth::validate_token(&params.token).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "invalid token" })),
        )
    })?;

    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "invalid token payload" })),
        )
    })?;

    Ok(ws.on_upgrade(move |socket| handle_socket(socket, state, user_id)))
}

async fn handle_socket(socket: WebSocket, state: AppState, user_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let tx2 = tx.clone();
    let ws = state.ws.clone();

    // Register active user in the CallManager registry
    state.call_manager.register_peer(user_id, tx.clone());

    // Broadcast user presence as online
    broadcast_presence(&state, user_id, "online").await;

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let state_clone = state.clone();
    let tx2_clone = tx2.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    // 1. Try parsing as WebRTC Signaling Message first
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        let _ = handle_signaling_message(&state_clone, user_id, ws_msg, &tx2_clone).await;
                    } 
                    // 2. Fallback to standard chat room Subscribe/Unsubscribe command
                    else if let Ok(cmd) = serde_json::from_str::<WsCommand>(&text) {
                        match cmd {
                            WsCommand::Subscribe { chat_id } => {
                                ws.subscribe(chat_id, tx2_clone.clone()).await;
                            }
                            WsCommand::Unsubscribe { chat_id } => {
                                ws.unsubscribe(chat_id, &tx2_clone).await;
                            }
                            WsCommand::Ping => {
                                let _ = tx2_clone.send(json!({"type": "pong"}).to_string());
                            }
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Clean up connections on disconnect
    state.call_manager.unregister_peer(user_id);
    broadcast_presence(&state, user_id, "offline").await;
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum WsCommand {
    #[serde(rename = "subscribe")]
    Subscribe { chat_id: Uuid },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { chat_id: Uuid },
    #[serde(rename = "ping")]
    Ping,
}

async fn handle_signaling_message(
    state: &AppState,
    user_id: Uuid,
    msg: WsMessage,
    tx: &tokio::sync::mpsc::UnboundedSender<String>,
) -> Result<(), String> {
    match msg {
        WsMessage::CallStart { call_id: _, target_user_id, caller_username: _ } => {
            // Fetch caller's username
            let caller_username = sqlx::query_scalar::<_, String>(
                "SELECT username FROM users WHERE id = $1"
            )
            .bind(user_id)
            .fetch_one(&state.pool)
            .await
            .unwrap_or_else(|_| "Unknown User".to_string());

            match state.call_manager.start_call(user_id, target_user_id) {
                Ok(call_id) => {
                    // Forward Incoming call signal to target callee
                    let incoming = WsMessage::CallStart {
                        call_id: Some(call_id),
                        target_user_id: user_id, // Target sees Alice as the caller
                        caller_username: Some(caller_username),
                    };
                    let incoming_json = serde_json::to_string(&incoming).unwrap();
                    if state.call_manager.send_to_user(target_user_id, &incoming_json) {
                        // Confirm to caller that call is initiating
                        let ack = WsMessage::CallStart {
                            call_id: Some(call_id),
                            target_user_id,
                            caller_username: None,
                        };
                        let _ = tx.send(serde_json::to_string(&ack).unwrap());
                    } else {
                        // Recipient offline (cleanup and record missed)
                        state.call_manager.terminate_call(call_id, "callee offline").ok();
                        save_call_db(&state.pool, user_id, target_user_id, "missed", 0, chrono::Utc::now());
                        
                        let fail = WsMessage::CallFailed {
                            call_id,
                            reason: "Recipient offline".to_string(),
                        };
                        let _ = tx.send(serde_json::to_string(&fail).unwrap());
                    }
                }
                Err(err) => {
                    let fail = WsMessage::CallFailed {
                        call_id: Uuid::nil(),
                        reason: err,
                    };
                    let _ = tx.send(serde_json::to_string(&fail).unwrap());
                }
            }
        }
        WsMessage::CallRinging { call_id, caller_id } => {
            if state.call_manager.set_call_ringing(call_id).is_ok() {
                let ring_json = serde_json::to_string(&WsMessage::CallRinging { call_id, caller_id }).unwrap();
                state.call_manager.send_to_user(caller_id, &ring_json);
            }
        }
        WsMessage::CallAccepted { call_id } => {
            let active_call = {
                let call_ref = state.call_manager.active_calls.get(&call_id);
                call_ref.map(|r| r.clone())
            };
            if let Some(call) = active_call {
                if state.call_manager.accept_call(call_id, user_id).is_ok() {
                    let accept_json = serde_json::to_string(&WsMessage::CallAccepted { call_id }).unwrap();
                    state.call_manager.send_to_user(call.caller_id, &accept_json);
                }
            }
        }
        WsMessage::CallRejected { call_id } => {
            if let Ok(call) = state.call_manager.terminate_call(call_id, "rejected") {
                save_call_db(&state.pool, call.caller_id, call.callee_id, "rejected", 0, call.created_at);
                let reject_json = serde_json::to_string(&WsMessage::CallRejected { call_id }).unwrap();
                state.call_manager.send_to_user(call.caller_id, &reject_json);
            }
        }
        WsMessage::CallEnded { call_id } => {
            if let Ok(call) = state.call_manager.end_call(call_id, user_id) {
                let duration = (chrono::Utc::now() - call.created_at).num_seconds() as i32;
                let status = if call.state == CallState::Connected { "completed" } else { "missed" };
                save_call_db(&state.pool, call.caller_id, call.callee_id, status, duration, call.created_at);

                let other_id = if user_id == call.caller_id { call.callee_id } else { call.caller_id };
                let end_json = serde_json::to_string(&WsMessage::CallEnded { call_id }).unwrap();
                state.call_manager.send_to_user(other_id, &end_json);
            }
        }
        WsMessage::CallFailed { call_id, reason } => {
            if let Ok(call) = state.call_manager.terminate_call(call_id, &reason) {
                save_call_db(&state.pool, call.caller_id, call.callee_id, "failed", 0, call.created_at);

                let other_id = if user_id == call.caller_id { call.callee_id } else { call.caller_id };
                let fail_json = serde_json::to_string(&WsMessage::CallFailed { call_id, reason }).unwrap();
                state.call_manager.send_to_user(other_id, &fail_json);
            }
        }
        WsMessage::Offer { call_id, sdp } => {
            if let Some(call) = state.call_manager.active_calls.get(&call_id) {
                if call.caller_id == user_id || call.callee_id == user_id {
                    let recipient = if user_id == call.caller_id { call.callee_id } else { call.caller_id };
                    let offer_json = serde_json::to_string(&WsMessage::Offer { call_id, sdp }).unwrap();
                    state.call_manager.send_to_user(recipient, &offer_json);
                }
            }
        }
        WsMessage::Answer { call_id, sdp } => {
            let active_call = {
                let call_ref = state.call_manager.active_calls.get(&call_id);
                call_ref.map(|r| r.clone())
            };
            if let Some(call) = active_call {
                if call.caller_id == user_id || call.callee_id == user_id {
                    let recipient = if user_id == call.caller_id { call.callee_id } else { call.caller_id };
                    let _ = state.call_manager.update_webrtc_connected(call_id);
                    let answer_json = serde_json::to_string(&WsMessage::Answer { call_id, sdp }).unwrap();
                    state.call_manager.send_to_user(recipient, &answer_json);
                }
            }
        }
        WsMessage::IceCandidate { call_id, candidate } => {
            if let Some(call) = state.call_manager.active_calls.get(&call_id) {
                if call.caller_id == user_id || call.callee_id == user_id {
                    let recipient = if user_id == call.caller_id { call.callee_id } else { call.caller_id };
                    let ice_json = serde_json::to_string(&WsMessage::IceCandidate { call_id, candidate }).unwrap();
                    state.call_manager.send_to_user(recipient, &ice_json);
                }
            }
        }
        WsMessage::Ping => {
            let pong_json = serde_json::to_string(&WsMessage::Pong).unwrap();
            let _ = tx.send(pong_json);
        }
        WsMessage::Pong => {}
        WsMessage::Presence { .. } => {}
        WsMessage::CallBusy { call_id } => {
            if let Some(call) = state.call_manager.active_calls.get(&call_id) {
                let caller_id = call.caller_id;
                let busy_json = serde_json::to_string(&WsMessage::CallBusy { call_id }).unwrap();
                state.call_manager.send_to_user(caller_id, &busy_json);
            }
        }
    }
    Ok(())
}

async fn broadcast_presence(state: &AppState, user_id: Uuid, status: &str) {
    let msg = WsMessage::Presence {
        user_id,
        status: status.to_string(),
    };
    let msg_str = serde_json::to_string(&msg).unwrap();
    // In a production server, this broadcasts to all online friends / peers.
    // For simplicity, we broadcast to all active websocket connections.
    for peer in state.call_manager.peers.iter() {
        if *peer.key() != user_id {
            let _ = peer.value().send(msg_str.clone());
        }
    }
}

fn save_call_db(
    pool: &sqlx::PgPool,
    caller_id: Uuid,
    callee_id: Uuid,
    status: &'static str,
    duration: i32,
    created_at: chrono::DateTime<chrono::Utc>,
) {
    let pool = pool.clone();
    let status_str = status.to_string();
    tokio::spawn(async move {
        sqlx::query(
            "INSERT INTO call_logs (caller_id, callee_id, status, duration, created_at) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(caller_id)
        .bind(callee_id)
        .bind(status_str)
        .bind(duration)
        .bind(created_at)
        .execute(&pool)
        .await
        .ok();
    });
}
