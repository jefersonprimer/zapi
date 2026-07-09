use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct CallLog {
    pub id: Uuid,
    pub caller_id: Uuid,
    pub callee_id: Uuid,
    pub status: String, // 'completed', 'missed', 'rejected', 'failed', 'busy'
    pub duration: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct CallHistoryResponse {
    pub id: Uuid,
    pub caller_id: Uuid,
    pub caller_username: String,
    pub callee_id: Uuid,
    pub callee_username: String,
    pub status: String,
    pub duration: i32,
    pub created_at: DateTime<Utc>,
}
