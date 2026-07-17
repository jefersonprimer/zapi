use sqlx::PgPool;
use tracing::info;

pub async fn expire_stories(pool: PgPool) {
    let result = sqlx::query(
        r#"
        UPDATE stories SET is_expired = TRUE
        WHERE expires_at < NOW() AND is_expired = FALSE
        "#,
    )
    .execute(&pool)
    .await;

    match result {
        Ok(r) => {
            if r.rows_affected() > 0 {
                info!("Expired {} stories", r.rows_affected());
            }
        }
        Err(e) => tracing::error!("Failed to expire stories: {}", e),
    }
}

pub fn start_story_cleanup(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
        loop {
            interval.tick().await;
            expire_stories(pool.clone()).await;
        }
    });
}
