use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub async fn connect() -> PgPool {
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("failed to connect to database");

    tracing::info!("connected to database");

    pool
}
