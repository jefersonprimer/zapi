use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize)]
#[allow(dead_code)]
pub struct Chat {
    pub id: Uuid,
    pub is_group: bool,
    pub name: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize)]
pub struct ChatListItem {
    pub id: Uuid,
    pub participant_id: Option<Uuid>,
    pub participant_username: Option<String>,
    pub is_group: bool,
    pub name: Option<String>,
    pub last_message: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub unread_count: i64,
}
