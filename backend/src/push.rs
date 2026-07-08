use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

pub async fn send_push_notification(pool: &PgPool, chat_id: Uuid, sender_name: &str, content: &str, exclude_user_id: Uuid) {
    let tokens: Vec<(String,)> = sqlx::query_as(
        "SELECT token FROM push_tokens WHERE user_id IN (
            SELECT user_id FROM chat_participants WHERE chat_id = $1 AND user_id != $2
        )",
    )
    .bind(chat_id)
    .bind(exclude_user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if tokens.is_empty() {
        return;
    }

    let messages: Vec<serde_json::Value> = tokens
        .into_iter()
        .map(|(token,)| {
            json!({
                "to": token,
                "title": sender_name,
                "body": content,
                "data": { "chat_id": chat_id.to_string() },
                "sound": "default"
            })
        })
        .collect();

    let client = reqwest::Client::new();
    let _ = client
        .post("https://exp.host/--/api/v2/push/send")
        .json(&messages)
        .send()
        .await;
}
