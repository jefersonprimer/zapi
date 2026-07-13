mod auth;
mod db;
mod handlers;
mod models;
pub mod push;
mod routes;
pub mod ws;
pub mod signaling;

use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub ws: ws::WsState,
    pub call_manager: signaling::CallManager,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter("primer_chat=debug,tower_http=debug")
        .init();

    let pool = db::connect().await;

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("failed to run migrations");

    // Start background notification queue worker
    push::start_notification_worker(pool.clone());

    let state = AppState {
        pool,
        ws: ws::WsState::default(),
        call_manager: signaling::CallManager::new(),
    };

    let app = routes::create_router(state).layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
