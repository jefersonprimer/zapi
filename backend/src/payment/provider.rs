use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentSplit {
    pub recipient_account_id: String,
    pub percentage: f64,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentRequest {
    pub order_id: Uuid,
    pub amount: f64,
    pub payment_method: String, // "pix", "credit_card", "debit_card"
    pub splits: Vec<PaymentSplit>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaymentResponse {
    pub payment_id: String,
    pub status: String, // "pending", "paid", "failed"
    pub details: serde_json::Value,
}

#[allow(async_fn_in_trait)]
pub trait PaymentProvider: Send + Sync {
    async fn create_payment(&self, req: PaymentRequest) -> Result<PaymentResponse, String>;
    async fn refund_payment(&self, payment_id: &str) -> Result<PaymentResponse, String>;
}
