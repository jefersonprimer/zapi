use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct PixKey {
    pub id: Uuid,
    pub user_id: Uuid,
    pub pix_type: String,
    pub pix_value: String,
    pub full_name: String,
    pub visibility: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePixKeyRequest {
    pub pix_type: String,
    pub pix_value: String,
    pub full_name: String,
    pub visibility: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePixKeyRequest {
    pub pix_type: Option<String>,
    pub pix_value: Option<String>,
    pub full_name: Option<String>,
    pub visibility: Option<String>,
}
