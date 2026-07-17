use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// === Publishers ===

#[derive(Debug, FromRow, Serialize)]
pub struct Publisher {
    pub id: Uuid,
    pub r#type: String,
    pub ref_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PublisherWithFollow {
    pub id: Uuid,
    #[serde(rename = "type")]
    pub r#type: String,
    pub ref_id: Uuid,
    pub name: String,
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub is_following: bool,
    pub followers_count: i64,
    pub following_count: i64,
}

impl PublisherWithFollow {
    pub fn from_publisher(
        p: Publisher,
        username: Option<String>,
        is_following: bool,
        followers_count: i64,
        following_count: i64,
    ) -> Self {
        Self {
            id: p.id,
            r#type: p.r#type,
            ref_id: p.ref_id,
            name: p.name,
            username,
            avatar_url: p.avatar_url,
            is_verified: p.is_verified,
            created_at: p.created_at,
            is_following,
            followers_count,
            following_count,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreatePublisherRequest {
    pub r#type: String,
    pub ref_id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
}

// === Stories ===

#[derive(Debug, FromRow, Serialize)]
pub struct Story {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub content: Option<String>,
    pub background_color: Option<String>,
    pub font_color: Option<String>,
    pub is_expired: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryWithPublisher {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub publisher_name: String,
    pub publisher_avatar: Option<String>,
    pub publisher_type: String,
    pub is_verified: bool,
    pub content: Option<String>,
    pub background_color: Option<String>,
    pub font_color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub viewed: bool,
    pub attachments: Vec<StoryAttachment>,
}

#[derive(Debug, Serialize)]
pub struct StoryGroup {
    pub publisher_id: Uuid,
    pub publisher_name: String,
    pub publisher_avatar: Option<String>,
    pub publisher_type: String,
    pub is_verified: bool,
    pub stories: Vec<StoryWithPublisher>,
    pub all_viewed: bool,
}

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct StoryAttachment {
    pub id: Uuid,
    pub story_id: Uuid,
    pub r#type: String,
    pub url: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoryRequest {
    pub content: Option<String>,
    pub background_color: Option<String>,
    pub font_color: Option<String>,
    pub attachments: Vec<AttachmentRequest>,
}

// === Posts ===

#[derive(Debug, FromRow, Serialize)]
pub struct Post {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub r#type: String,
    pub content: Option<String>,
    pub visibility: String,
    pub is_pinned: bool,
    pub poll_expires_at: Option<DateTime<Utc>>,
    pub likes_count: i32,
    pub comments_count: i32,
    pub shares_count: i32,
    pub score: f64,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PostWithDetails {
    pub id: Uuid,
    pub publisher_id: Uuid,
    pub publisher_name: String,
    pub publisher_avatar: Option<String>,
    pub publisher_type: String,
    pub is_verified: bool,
    pub r#type: String,
    pub content: Option<String>,
    pub visibility: String,
    pub is_pinned: bool,
    pub attachments: Vec<PostAttachment>,
    pub poll_options: Option<Vec<PollOptionResponse>>,
    pub poll_expires_at: Option<DateTime<Utc>>,
    pub likes_count: i32,
    pub comments_count: i32,
    pub shares_count: i32,
    pub created_at: DateTime<Utc>,
    pub liked_by_me: bool,
    pub saved_by_me: bool,
    pub voted_option: Option<String>,
}

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct PostAttachment {
    pub id: Uuid,
    pub post_id: Uuid,
    pub r#type: String,
    pub url: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
    pub thumbnail_url: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub r#type: String,
    pub content: Option<String>,
    pub visibility: Option<String>,
    pub attachments: Vec<AttachmentRequest>,
    pub poll_options: Option<Vec<String>>,
    pub poll_duration_hours: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct AttachmentRequest {
    pub url: String,
    pub r#type: String,
    pub mime_type: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
    pub size: Option<i32>,
    pub sha256: Option<String>,
}

// === Interactions ===

#[derive(Debug, Clone, Serialize)]
pub struct PollOptionResponse {
    pub id: String,
    pub label: String,
    pub votes_count: i32,
    pub percentage: f64,
}

#[derive(Debug, Serialize)]
pub struct CommentResponse {
    pub id: String,
    pub user_id: String,
    pub user_name: String,
    pub user_avatar: Option<String>,
    pub parent_id: Option<String>,
    pub content: String,
    pub likes_count: i32,
    pub liked_by_me: bool,
    pub created_at: String,
    pub replies: Vec<CommentResponse>,
}

#[derive(Debug, Deserialize)]
pub struct CommentRequest {
    pub content: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PollVoteRequest {
    pub option_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ShareRequest {
    pub share_target: String,
    pub target_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportRequest {
    pub source_type: String,
    pub source_id: String,
    pub reason: String,
    pub description: Option<String>,
}
