use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::{StatusCode, HeaderMap}, Json};
use futures_util::SinkExt;
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

// QR Code Authentication structures & handlers
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateQrResponse {
    pub session_id: Uuid,
    pub code: String,
    pub expires_in: i64,
}

#[derive(Debug, Deserialize)]
pub struct ApproveQrRequest {
    pub code: String,
    pub approve: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: Uuid,
    pub code: String,
    pub status: String,
    pub browser: Option<String>,
    pub platform: Option<String>,
    pub ip: Option<String>,
}

fn parse_user_agent(ua: &str) -> (String, String) {
    let platform = if ua.contains("Windows") {
        "Windows"
    } else if ua.contains("Macintosh") || ua.contains("Mac OS X") {
        "macOS"
    } else if ua.contains("Linux") {
        "Linux"
    } else if ua.contains("Android") {
        "Android"
    } else if ua.contains("iPhone") || ua.contains("iPad") {
        "iOS"
    } else {
        "Unknown Platform"
    };

    let browser = if ua.contains("Chrome") || ua.contains("CriOS") {
        "Chrome"
    } else if ua.contains("Firefox") || ua.contains("FxiOS") {
        "Firefox"
    } else if ua.contains("Safari") && !ua.contains("Chrome") {
        "Safari"
    } else if ua.contains("Edge") || ua.contains("Edg") {
        "Edge"
    } else {
        "Unknown Browser"
    };

    (browser.to_string(), platform.to_string())
}

pub async fn create_web_qr_session(
    State(state): State<crate::AppState>,
    headers: HeaderMap,
) -> Result<Json<CreateQrResponse>, (StatusCode, Json<Value>)> {
    use rand::Rng;
    let code: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(24)
        .map(|c| c as char)
        .collect();

    let user_agent = headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("Unknown");
    
    let (browser, platform) = parse_user_agent(user_agent);

    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(60);

    let row = sqlx::query!(
        "INSERT INTO web_login_sessions (code, browser, platform, ip, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id",
        code,
        browser,
        platform,
        ip,
        expires_at
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to create QR session: {}", e) })),
        )
    })?;

    Ok(Json(CreateQrResponse {
        session_id: row.id,
        code,
        expires_in: 60,
    }))
}

pub async fn get_web_qr_session(
    State(state): State<crate::AppState>,
    axum::extract::Path(code): axum::extract::Path<String>,
) -> Result<Json<SessionResponse>, (StatusCode, Json<Value>)> {
    let now = chrono::Utc::now();
    let session = sqlx::query!(
        "SELECT id, code, status, browser, platform, ip, expires_at FROM web_login_sessions WHERE code = $1",
        code
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "QR Code session not found" })),
        )
    })?;

    // Check expiration
    let status = if session.status == "waiting" && session.expires_at < now {
        "expired".to_string()
    } else {
        session.status
    };

    Ok(Json(SessionResponse {
        id: session.id,
        code: session.code,
        status,
        browser: session.browser,
        platform: session.platform,
        ip: session.ip,
    }))
}

pub async fn approve_web_qr_session(
    State(state): State<crate::AppState>,
    auth: crate::auth::AuthUser,
    Json(body): Json<ApproveQrRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth.0;
    let now = chrono::Utc::now();
    
    let session = sqlx::query!(
        "SELECT id, status, expires_at FROM web_login_sessions WHERE code = $1",
        body.code
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "QR Code session not found" })),
        )
    })?;

    if session.status != "waiting" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": format!("QR session is already {:?}", session.status) })),
        ));
    }

    if session.expires_at < now {
        // Update to expired
        let _ = sqlx::query!(
            "UPDATE web_login_sessions SET status = 'expired' WHERE id = $1",
            session.id
        )
        .execute(&state.pool)
        .await;

        return Err((
            StatusCode::GONE,
            Json(json!({ "error": "QR Code session has expired" })),
        ));
    }

    let is_approved = body.approve.unwrap_or(true);
    let new_status = if is_approved { "approved" } else { "cancelled" };

    sqlx::query!(
        "UPDATE web_login_sessions
         SET status = $1, user_id = $2, approved_at = $3
         WHERE id = $4",
        new_status,
        user_id,
        if is_approved { Some(now) } else { None },
        session.id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to update session: {}", e) })),
        )
    })?;

    if is_approved {
        // Generate JWT token for web client
        let token = crate::auth::create_token(user_id).map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Failed to generate token" })),
            )
        })?;

        // Broadcast success via WebSocket to the browser
        state.ws.broadcast(
            session.id,
            &json!({
                "type": "login_success",
                "token": token
            })
            .to_string(),
        )
        .await;
    } else {
        // Broadcast cancellation to browser
        state.ws.broadcast(
            session.id,
            &json!({
                "type": "cancelled"
            })
            .to_string(),
        )
        .await;
    }

    Ok(Json(json!({ "status": new_status })))
}

pub async fn cancel_web_qr_session(
    State(state): State<crate::AppState>,
    Json(body): Json<ApproveQrRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let session = sqlx::query!(
        "SELECT id, status FROM web_login_sessions WHERE code = $1",
        body.code
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Database error: {}", e) })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "QR Code session not found" })),
        )
    })?;

    if session.status != "waiting" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "QR session is not in waiting state" })),
        ));
    }

    sqlx::query!(
        "UPDATE web_login_sessions SET status = 'cancelled' WHERE id = $1",
        session.id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("Failed to cancel session: {}", e) })),
        )
    })?;

    // Broadcast cancellation
    state.ws.broadcast(
        session.id,
        &json!({
            "type": "cancelled"
        })
        .to_string(),
    )
    .await;

    Ok(Json(json!({ "status": "cancelled" })))
}

// WebSocket connection for the web browser
pub async fn qr_ws_handler(
    ws: axum::extract::ws::WebSocketUpgrade,
    axum::extract::Path(session_id): axum::extract::Path<Uuid>,
    State(state): State<crate::AppState>,
) -> impl axum::response::IntoResponse {
    ws.on_upgrade(move |socket| handle_qr_socket(socket, state, session_id))
}

async fn handle_qr_socket(socket: axum::extract::ws::WebSocket, state: crate::AppState, session_id: Uuid) {
    use futures_util::StreamExt;
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Subscribe to ws channel with session_id
    state.ws.subscribe(session_id, tx.clone()).await;

    // Send initial status message
    let _ = tx.send(json!({ "type": "waiting" }).to_string());

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(axum::extract::ws::Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let tx_clone = tx.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                axum::extract::ws::Message::Text(text) => {
                    if text == "ping" || text.contains("ping") {
                        let _ = tx_clone.send(json!({ "type": "pong" }).to_string());
                    }
                }
                axum::extract::ws::Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    state.ws.unsubscribe(session_id, &tx).await;
}

