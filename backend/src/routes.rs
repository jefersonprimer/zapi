use axum::{extract::{FromRef, DefaultBodyLimit}, routing::delete, routing::get, routing::post, routing::put, Router};
use sqlx::PgPool;
use tower_http::services::ServeDir;

use crate::handlers;
use crate::notes;
use crate::updates;
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

impl FromRef<AppState> for crate::signaling::CallManager {
    fn from_ref(state: &AppState) -> Self {
        state.call_manager.clone()
    }
}

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(handlers::health::health_check))
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login))
        .route("/auth/web/qr", post(handlers::auth::create_web_qr_session))
        .route("/auth/web/session/:code", get(handlers::auth::get_web_qr_session))
        .route("/auth/web/approve", post(handlers::auth::approve_web_qr_session))
        .route("/auth/web/cancel", post(handlers::auth::cancel_web_qr_session))
        .route("/auth/web/ws/:session_id", get(handlers::auth::qr_ws_handler))
        .route("/chats", get(handlers::chats::list_chats).post(handlers::chats::create_chat))
        .route("/chats/:id", delete(handlers::chats::delete_chat))
        .route("/chats/:id/favorite", post(handlers::chats::favorite_chat))
        .route("/chats/:id/mute", post(handlers::chats::mute_chat))
        .route("/chats/:id/archive", post(handlers::chats::archive_chat))
        .route("/chats/:id/lists", post(handlers::chats::update_chat_lists_membership))
        .route("/chat-lists", get(handlers::chats::list_chat_lists).post(handlers::chats::create_chat_list))
        .route("/chat-lists/:id", post(handlers::chats::update_chat_list).delete(handlers::chats::delete_chat_list))
        .route("/chats/:id/messages", get(handlers::messages::get_messages).post(handlers::messages::send_message))
        .route("/chats/:id/messages/:message_id", delete(handlers::messages::delete_message))
        .route("/chats/:id/messages/:message_id/react", post(handlers::messages::react_to_message))
        .route("/chats/:id/messages/:message_id/stickers", post(handlers::placed_stickers::place_sticker))
        .route("/chats/:id/messages/:message_id/stickers/:sticker_id", delete(handlers::placed_stickers::remove_sticker))
        .route("/chats/:id/read", post(handlers::messages::mark_chat_read))
        .route("/chats/:id/clear", post(handlers::messages::clear_chat_messages))
        .route("/users/search", get(handlers::users::search_users))
        .route("/users/profile", post(handlers::users::update_profile))
        .route("/push/register", post(handlers::push::register_push_token))
        .route("/groups", post(handlers::groups::create_group))
        .route("/groups/:id", get(handlers::groups::get_group_details).post(handlers::groups::update_group))
        .route("/groups/:id/add", post(handlers::groups::add_participant))
        .route("/groups/:id/remove/:user_id", delete(handlers::groups::remove_participant))
        .route("/upload", post(handlers::upload::upload_image).layer(DefaultBodyLimit::disable()))
        .route("/upload/check-hash", get(handlers::upload::check_hash))
        .route("/calls/start", post(handlers::calls::start_call))
        .route("/calls/end", post(handlers::calls::end_call))
        .route("/calls/history", get(handlers::calls::get_history))
        .route("/calls/:id", delete(handlers::calls::delete_call))
        .route("/contacts", get(handlers::contacts::list_contacts))
        .route("/contacts", post(handlers::contacts::add_contact))
        .route("/contacts/:contact_id", put(handlers::contacts::update_contact).delete(handlers::contacts::remove_contact))
        .route("/contacts/:contact_id/block", post(handlers::contacts::block_contact))
        .route("/contacts/:contact_id/unblock", post(handlers::contacts::unblock_contact))
        .route("/pix/me", get(handlers::pix::get_my_pix_key))
        .route("/pix", post(handlers::pix::upsert_pix_key).put(handlers::pix::update_pix_key).delete(handlers::pix::delete_pix_key))
        .route("/pix/:user_id", get(handlers::pix::get_user_pix_key))
        .route("/ws", get(handlers::ws::ws_handler))
        .nest("/notes", notes::routes::router())
        .nest("/updates", updates::routes::router())
        .nest("/delivery", handlers::delivery::router())
        .nest("/communities", handlers::communities::router())
        .route("/stickers/remove-bg", post(handlers::stickers::remove_background).layer(DefaultBodyLimit::disable()))
        .route("/stickers/remove-bg-url", post(handlers::stickers::remove_background_url))
        .nest_service("/uploads", ServeDir::new("uploads"))
        .with_state(state)
}
