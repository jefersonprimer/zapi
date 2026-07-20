use crate::payment::provider::{PaymentProvider, PaymentRequest, PaymentResponse};
use serde_json::json;

pub struct MockProvider;

impl PaymentProvider for MockProvider {
    async fn create_payment(&self, req: PaymentRequest) -> Result<PaymentResponse, String> {
        let payment_id = format!("pay_mock_{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
        
        match req.payment_method.as_str() {
            "pix" => {
                let details = json!({
                    "qr_code": "00020101021226870014br.gov.bcb.pix2565pix-sandbox.pagarme.com/qr/v2/mock_pix_payment_zapi_key_1234567890",
                    "pix_copia_e_cola": "00020101021226870014br.gov.bcb.pix2565pix-sandbox.pagarme.com/qr/v2/mock_pix_payment_zapi_key_1234567890",
                    "expires_at": (chrono::Utc::now() + chrono::Duration::minutes(15)).to_rfc3339(),
                    "splits": req.splits
                });
                
                Ok(PaymentResponse {
                    payment_id,
                    status: "pending".to_string(),
                    details,
                })
            }
            "credit_card" | "debit_card" => {
                let details = json!({
                    "brand": "Visa",
                    "last_four": "4242",
                    "transaction_id": format!("tx_{}", uuid::Uuid::new_v4().to_string()[..12].to_string()),
                    "splits": req.splits
                });
                
                Ok(PaymentResponse {
                    payment_id,
                    status: "paid".to_string(),
                    details,
                })
            }
            other => Err(format!("Unsupported payment method in Mock: {}", other)),
        }
    }

    async fn refund_payment(&self, payment_id: &str) -> Result<PaymentResponse, String> {
        Ok(PaymentResponse {
            payment_id: payment_id.to_string(),
            status: "refunded".to_string(),
            details: json!({
                "refunded_at": chrono::Utc::now().to_rfc3339()
            }),
        })
    }
}
