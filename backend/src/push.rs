use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::Utc;

pub async fn send_push_notification(
    pool: &PgPool,
    chat_id: Uuid,
    sender_name: &str,
    content: &str,
    sender_avatar_url: Option<&str>,
    offline_user_ids: Vec<Uuid>,
) {
    if offline_user_ids.is_empty() {
        return;
    }

    let devices: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT user_id, token FROM device_tokens WHERE user_id = ANY($1)",
    )
    .bind(&offline_user_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if devices.is_empty() {
        return;
    }

    let privacy_rows: Vec<(Uuid, bool)> = sqlx::query_as(
        "SELECT id, show_notification_preview FROM users WHERE id = ANY($1)",
    )
    .bind(&offline_user_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let privacy_settings: std::collections::HashMap<Uuid, bool> = privacy_rows
        .into_iter()
        .collect();

    for (user_id, token) in devices {
        let show_preview = privacy_settings.get(&user_id).cloned().unwrap_or(true);
        let body_text = if show_preview {
            content.to_string()
        } else {
            "Nova mensagem recebida".to_string()
        };

        let data_payload = json!({
            "chat_id": chat_id.to_string(),
            "sender_avatar_url": sender_avatar_url,
        });

        let _ = sqlx::query(
            "INSERT INTO notification_queue (user_id, device_token, title, body, data_payload, channel_id) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(user_id)
        .bind(token)
        .bind(sender_name)
        .bind(&body_text)
        .bind(data_payload)
        .bind("messages")
        .execute(pool)
        .await;
    }
}

pub async fn send_community_push_notification(
    pool: &PgPool,
    community_id: Uuid,
    sender_name: &str,
    content: &str,
    member_ids: Vec<Uuid>,
    exclude_user_id: Option<Uuid>,
) {
    let target_ids: Vec<Uuid> = if let Some(exclude) = exclude_user_id {
        member_ids.into_iter().filter(|id| *id != exclude).collect()
    } else {
        member_ids
    };

    if target_ids.is_empty() {
        return;
    }

    let devices: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT user_id, token FROM device_tokens WHERE user_id = ANY($1)",
    )
    .bind(&target_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if devices.is_empty() {
        return;
    }

    let privacy_rows: Vec<(Uuid, bool)> = sqlx::query_as(
        "SELECT id, show_notification_preview FROM users WHERE id = ANY($1)",
    )
    .bind(&target_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let privacy_settings: std::collections::HashMap<Uuid, bool> = privacy_rows
        .into_iter()
        .collect();

    for (user_id, token) in devices {
        let show_preview = privacy_settings.get(&user_id).cloned().unwrap_or(true);
        let body_text = if show_preview {
            content.to_string()
        } else {
            "Nova atividade na comunidade".to_string()
        };

        let data_payload = json!({
            "community_id": community_id.to_string(),
            "type": "community_notification"
        });

        let _ = sqlx::query(
            "INSERT INTO notification_queue (user_id, device_token, title, body, data_payload, channel_id) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(user_id)
        .bind(token)
        .bind(sender_name)
        .bind(&body_text)
        .bind(data_payload)
        .bind("messages")
        .execute(pool)
        .await;
    }
}

pub async fn send_call_push_notification(
    pool: &PgPool,
    recipient_id: Uuid,
    caller_name: &str,
    call_id: Uuid,
    caller_id: Uuid,
    is_video: bool,
    caller_avatar_url: Option<&str>,
) {
    let devices: Vec<(String,)> = sqlx::query_as(
        "SELECT token FROM device_tokens WHERE user_id = $1",
    )
    .bind(recipient_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if devices.is_empty() {
        return;
    }

    let body = if is_video {
        "Chamada de vídeo recebida"
    } else {
        "Chamada de voz recebida"
    };

    let data_payload = json!({
        "type": "incoming_call",
        "callId": call_id.to_string(),
        "callerId": caller_id.to_string(),
        "callerUsername": caller_name.to_string(),
        "callerAvatarUrl": caller_avatar_url,
        "isVideo": is_video
    });

    for (token,) in devices {
        let _ = sqlx::query(
            "INSERT INTO notification_queue (user_id, device_token, title, body, data_payload, channel_id) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(recipient_id)
        .bind(token)
        .bind(caller_name)
        .bind(body)
        .bind(data_payload.clone())
        .bind("calls")
        .execute(pool)
        .await;
    }
}

pub fn start_notification_worker(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(2));
        loop {
            interval.tick().await;
            if let Err(e) = process_notification_queue(&pool).await {
                tracing::error!("Error processing notification queue: {:?}", e);
            }
        }
    });
}

#[allow(dead_code)]
#[derive(sqlx::FromRow)]
struct PendingNotification {
    id: Uuid,
    user_id: Uuid,
    device_token: String,
    title: String,
    body: String,
    data_payload: Option<serde_json::Value>,
    channel_id: String,
    retry_count: i32,
    max_retries: i32,
}

async fn process_notification_queue(pool: &PgPool) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    let pending_rows: Vec<PendingNotification> = sqlx::query_as(
        "SELECT id, user_id, device_token, title, body, data_payload, channel_id, retry_count, max_retries \
         FROM notification_queue \
         WHERE status = 'pending' AND run_at <= NOW() \
         LIMIT 20 \
         FOR UPDATE SKIP LOCKED"
    )
    .fetch_all(&mut *tx)
    .await?;

    if pending_rows.is_empty() {
        tx.commit().await?;
        return Ok(());
    }

    let ids: Vec<Uuid> = pending_rows.iter().map(|r| r.id).collect();
    sqlx::query(
        "UPDATE notification_queue SET status = 'processing', updated_at = NOW() WHERE id = ANY($1)",
    )
    .bind(&ids)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let client = reqwest::Client::new();
    for row in pending_rows {
        let pool_clone = pool.clone();
        let client_clone = client.clone();
        tokio::spawn(async move {
            let data_payload = row.data_payload.unwrap_or_else(|| json!({}));

            let expo_message = json!({
                "to": row.device_token,
                "title": row.title,
                "body": row.body,
                "data": data_payload,
                "sound": "default",
                "ttl": 86400,
                "priority": "high",
                "channelId": row.channel_id,
                "_contentAvailable": true,
            });

            match client_clone
                .post("https://exp.host/--/api/v2/push/send")
                .json(&expo_message)
                .send()
                .await
            {
                Ok(resp) => {
                    let status_code = resp.status();
                    if status_code.is_success() {
                        if let Ok(body) = resp.json::<serde_json::Value>().await {
                            let mut is_registered_error = false;
                            if let Some(data) = body.get("data") {
                                if let Some(status) = data.get("status") {
                                    if status.as_str() == Some("error") {
                                        if let Some(details) = data.get("details") {
                                            if let Some(error) = details.get("error") {
                                                let err_str = error.as_str().unwrap_or_default();
                                                if err_str == "DeviceNotRegistered" {
                                                    is_registered_error = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            if is_registered_error {
                                let _ = sqlx::query(
                                    "DELETE FROM device_tokens WHERE token = $1",
                                )
                                .bind(&row.device_token)
                                .execute(&pool_clone)
                                .await;

                                let _ = sqlx::query(
                                    "UPDATE notification_queue SET status = 'invalid_token', updated_at = NOW() WHERE id = $1",
                                )
                                .bind(row.id)
                                .execute(&pool_clone)
                                .await;
                            } else {
                                let _ = sqlx::query(
                                    "UPDATE notification_queue SET status = 'sent', updated_at = NOW() WHERE id = $1",
                                )
                                .bind(row.id)
                                .execute(&pool_clone)
                                .await;
                            }
                        } else {
                            let _ = sqlx::query(
                                "UPDATE notification_queue SET status = 'sent', updated_at = NOW() WHERE id = $1",
                            )
                            .bind(row.id)
                            .execute(&pool_clone)
                            .await;
                        }
                    } else {
                        handle_failed_notification(&pool_clone, row.id, row.retry_count, row.max_retries).await;
                    }
                }
                Err(e) => {
                    tracing::error!("Network error sending push: {:?}", e);
                    handle_failed_notification(&pool_clone, row.id, row.retry_count, row.max_retries).await;
                }
            }
        });
    }

    Ok(())
}

async fn handle_failed_notification(pool: &PgPool, id: Uuid, retry_count: i32, max_retries: i32) {
    if retry_count < max_retries {
        let delay_seconds = 2_i64.pow(retry_count as u32);
        let next_run = Utc::now() + chrono::Duration::seconds(delay_seconds);
        let _ = sqlx::query(
            "UPDATE notification_queue \
             SET status = 'pending', retry_count = retry_count + 1, run_at = $1, updated_at = NOW() \
             WHERE id = $2",
        )
        .bind(next_run)
        .bind(id)
        .execute(pool)
        .await;
    } else {
        let _ = sqlx::query(
            "UPDATE notification_queue SET status = 'failed', updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(pool)
        .await;
    }
}
