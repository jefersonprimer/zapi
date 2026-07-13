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
    pub participant_avatar_url: Option<String>,
    pub is_group: bool,
    pub name: Option<String>,
    pub last_message: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub unread_count: i64,
    pub is_blocked_by_me: Option<bool>,
    pub is_blocked_by_them: Option<bool>,
    pub cleared_at: Option<DateTime<Utc>>,
    pub notification_muted_until: Option<DateTime<Utc>>,
    pub notification_muted_forever: Option<bool>,
    pub is_archived: Option<bool>,
    pub is_favorite: Option<bool>,
}
