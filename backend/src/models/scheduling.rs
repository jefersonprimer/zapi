use chrono::{DateTime, Utc, NaiveDate, NaiveTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Service {
    pub id: Uuid,
    pub store_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub price: f64,
    pub duration_minutes: i32,
    pub image_url: Option<String>,
    pub is_available: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Professional {
    pub id: Uuid,
    pub store_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct ProfessionalService {
    pub professional_id: Uuid,
    pub service_id: Uuid,
}

#[derive(Debug, FromRow, Serialize, Deserialize, Clone)]
pub struct Appointment {
    pub id: Uuid,
    pub store_id: Uuid,
    pub user_id: Uuid,
    pub service_id: Uuid,
    pub professional_id: Uuid,
    pub appointment_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: NaiveTime,
    pub status: String,
    pub client_name: String,
    pub client_phone: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
