use axum::{extract::FromRef, routing::delete, routing::get, routing::post, Router};
use sqlx::PgPool;
use tower_http::services::ServeDir;

use crate::handlers;
use crate::ws;
use crate::AppState;

impl FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

impl FromRef<AppState> for ws::WsState {
    fn from_ref(state: &AppState) -> Self {
        state.ws.clone()
    }
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(handlers::health::health_check))
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login))
        .route("/chats", get(handlers::chats::list_chats))
        .route("/chats", post(handlers::chats::create_chat))
        .route("/chats/:id/messages", get(handlers::messages::get_messages))
        .route("/chats/:id/messages", post(handlers::messages::send_message))
        .route("/users/search", get(handlers::users::search_users))
        .route("/push/register", post(handlers::push::register_push_token))
        .route("/groups", post(handlers::groups::create_group))
        .route("/groups/:id/add", post(handlers::groups::add_participant))
        .route("/groups/:id/remove/:user_id", delete(handlers::groups::remove_participant))
        .route("/upload", post(handlers::upload::upload_image))
        .route("/ws", get(handlers::ws::ws_handler))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .with_state(state)
}
