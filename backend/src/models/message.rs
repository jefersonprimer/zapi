use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Clone)]
pub struct Attachment {
    pub id: Uuid,
    pub message_id: Uuid,
    
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_field: String, // maps to/from 'type' in SQL and JSON
    
    pub remote_url: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
    pub size: Option<i32>,
    pub sha256: Option<String>,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, FromRow, Serialize, Clone)]
pub struct Message {
    pub id: Uuid,
    pub chat_id: Uuid,
    pub sender_id: Uuid,
    pub sender_username: String,
    pub content: Option<String>,
    pub image_url: Option<String>,
    pub order_id: Option<Uuid>,
    pub msg_type: String,
    pub created_at: DateTime<Utc>,
    pub deleted_for_everyone: bool,
    pub deleted_at: Option<DateTime<Utc>>,
    
    #[sqlx(skip)]
    pub attachments: Option<Vec<Attachment>>,

    #[sqlx(skip)]
    pub status: Option<String>,
}
