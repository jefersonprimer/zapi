use sqlx::PgPool;
use tracing::info;
use uuid::Uuid;

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

pub async fn expire_unaccepted_orders(
    pool: PgPool,
    ws: crate::ws::WsState,
    call_manager: crate::signaling::CallManager,
) {
    let expired_rows = match sqlx::query(
        r#"
        SELECT o.id, o.user_id, o.total::float8 as total, s.name as store_name, s.owner_id as store_owner_id
        FROM orders o
        JOIN stores s ON s.id = o.store_id
        WHERE o.status::text = 'WAITING_STORE_CONFIRMATION'
          AND o.created_at + (COALESCE(s.order_accept_timeout_minutes, 10) * INTERVAL '1 minute') < NOW()
        "#
    )
    .fetch_all(&pool)
    .await {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to fetch unaccepted expired orders: {:?}", e);
            return;
        }
    };

    for row in expired_rows {
        use sqlx::Row;
        let id: Uuid = row.try_get("id").unwrap_or_default();
        let user_id: Uuid = row.try_get("user_id").unwrap_or_default();
        let total: f64 = row.try_get("total").unwrap_or(0.0);
        let store_name: String = row.try_get("store_name").unwrap_or_default();
        let store_owner_id: Uuid = row.try_get("store_owner_id").unwrap_or_default();

        info!("Order {} has unaccepted store timeout. Triggering system cancellation...", id);
        
        let res = crate::handlers::delivery::execute_order_cancellation_and_refund(
            &pool,
            &ws,
            &call_manager,
            id,
            user_id,
            store_owner_id,
            &store_name,
            total,
            "SYSTEM",
            "A loja não aceitou o pedido dentro do tempo limite.",
        )
        .await;

        if let Err(e) = res {
            tracing::error!("Failed to cancel unaccepted order {}: {:?}", id, e);
        }
    }
}

pub fn start_order_timeout_worker(
    pool: PgPool,
    ws: crate::ws::WsState,
    call_manager: crate::signaling::CallManager,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        loop {
            interval.tick().await;
            expire_unaccepted_orders(pool.clone(), ws.clone(), call_manager.clone()).await;
        }
    });
}
