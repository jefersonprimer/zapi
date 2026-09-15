use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct LiveStream {
    pub id: Uuid,
    pub store_id: Uuid,
    pub publisher_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub stream_key: String,
    pub playback_url: Option<String>,
    pub status: String,
    pub viewer_count: i32,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct LiveStreamProduct {
    pub id: Uuid,
    pub live_stream_id: Uuid,
    pub product_id: Uuid,
    pub is_featured: bool,
    pub featured_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct LiveStreamMessage {
    pub id: Uuid,
    pub live_stream_id: Uuid,
    pub user_id: Uuid,
    pub message: String,
    pub created_at: DateTime<Utc>,
}
