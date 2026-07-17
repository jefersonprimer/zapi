use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use uuid::Uuid;

use crate::auth::AuthUser;

use super::models::*;
use super::scoring;

#[derive(Debug, serde::Deserialize)]
pub struct PaginationQuery {
    page: Option<i64>,
    limit: Option<i64>,
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": e.to_string() })),
    )
}

fn pagination(query: &PaginationQuery) -> (i64, i64) {
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * limit;
    (limit, offset)
}

/// Get the publisher id for a user, creating one from the users table if missing
/// (covers accounts that existed before publishers were introduced).
pub async fn ensure_user_publisher(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Uuid, (StatusCode, Json<Value>)> {
    if let Some((id,)) = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM publishers WHERE type = 'user' AND ref_id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(db_err)? {
        return Ok(id);
    }

    let user = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT username, name, avatar_url FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "User not found" })),
        )
    })?;

    let name = user.1.unwrap_or(user.0);
    let (id,) = sqlx::query_as::<_, (Uuid,)>(
        r#"
        INSERT INTO publishers (type, ref_id, name, avatar_url)
        VALUES ('user', $1, $2, $3)
        ON CONFLICT (type, ref_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(&name)
    .bind(&user.2)
    .fetch_one(pool)
    .await
    .map_err(db_err)?;

    Ok(id)
}

async fn ensure_user_publisher_full(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Publisher, (StatusCode, Json<Value>)> {
    let id = ensure_user_publisher(pool, user_id).await?;
    sqlx::query_as::<_, Publisher>(
        "SELECT id, type, ref_id, name, avatar_url, is_verified, created_at FROM publishers WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(db_err)
}

#[derive(Debug, FromRow)]
struct StoryRow {
    id: Uuid,
    publisher_id: Uuid,
    publisher_name: String,
    publisher_avatar: Option<String>,
    publisher_type: String,
    is_verified: bool,
    content: Option<String>,
    background_color: Option<String>,
    font_color: Option<String>,
    created_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    viewed: bool,
}

#[derive(Debug, FromRow)]
struct PostFeedRow {
    id: Uuid,
    publisher_id: Uuid,
    publisher_name: String,
    publisher_avatar: Option<String>,
    publisher_type: String,
    is_verified: bool,
    r#type: String,
    content: Option<String>,
    visibility: String,
    is_pinned: bool,
    poll_expires_at: Option<DateTime<Utc>>,
    likes_count: i32,
    comments_count: i32,
    shares_count: i32,
    created_at: DateTime<Utc>,
    liked_by_me: bool,
    saved_by_me: bool,
    voted_option: Option<Uuid>,
}

#[derive(Debug, FromRow)]
struct PollOptionRow {
    id: Uuid,
    label: String,
    votes_count: i32,
}

#[derive(Debug, FromRow)]
struct CommentRow {
    id: Uuid,
    user_id: Uuid,
    user_name: String,
    user_avatar: Option<String>,
    parent_id: Option<Uuid>,
    content: String,
    likes_count: i32,
    liked_by_me: bool,
    created_at: DateTime<Utc>,
}

async fn load_story_attachments(
    pool: &PgPool,
    story_id: Uuid,
) -> Result<Vec<StoryAttachment>, (StatusCode, Json<Value>)> {
    sqlx::query_as::<_, StoryAttachment>(
        r#"
        SELECT id, story_id, type, url, mime_type, width, height, duration
        FROM story_attachments
        WHERE story_id = $1
        ORDER BY sort_order
        "#,
    )
    .bind(story_id)
    .fetch_all(pool)
    .await
    .map_err(db_err)
}

async fn load_post_attachments(
    pool: &PgPool,
    post_id: Uuid,
) -> Result<Vec<PostAttachment>, (StatusCode, Json<Value>)> {
    sqlx::query_as::<_, PostAttachment>(
        r#"
        SELECT id, post_id, type, url, mime_type, width, height, duration, thumbnail_url, sort_order
        FROM post_attachments
        WHERE post_id = $1
        ORDER BY sort_order
        "#,
    )
    .bind(post_id)
    .fetch_all(pool)
    .await
    .map_err(db_err)
}

async fn load_poll_options(
    pool: &PgPool,
    post_id: Uuid,
) -> Result<Option<Vec<PollOptionResponse>>, (StatusCode, Json<Value>)> {
    let rows = sqlx::query_as::<_, PollOptionRow>(
        "SELECT id, label, votes_count FROM poll_options WHERE post_id = $1 ORDER BY sort_order",
    )
    .bind(post_id)
    .fetch_all(pool)
    .await
    .map_err(db_err)?;

    if rows.is_empty() {
        return Ok(None);
    }

    let total: i32 = rows.iter().map(|o| o.votes_count).sum();
    let options = rows
        .into_iter()
        .map(|o| {
            let percentage = if total > 0 {
                (o.votes_count as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            PollOptionResponse {
                id: o.id.to_string(),
                label: o.label,
                votes_count: o.votes_count,
                percentage,
            }
        })
        .collect();

    Ok(Some(options))
}

async fn recalculate_post_score(
    pool: &PgPool,
    post_id: Uuid,
) -> Result<(), (StatusCode, Json<Value>)> {
    let row = sqlx::query_as::<_, (i32, i32, i32, bool, DateTime<Utc>)>(
        "SELECT likes_count, comments_count, shares_count, is_pinned, created_at FROM posts WHERE id = $1",
    )
    .bind(post_id)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Post not found" })),
        )
    })?;

    let age_hours = (Utc::now() - row.4).num_seconds() as f64 / 3600.0;
    let score = scoring::calculate_score(
        age_hours,
        row.0,
        row.1,
        row.2,
        false,
        false,
        false,
        row.3,
    );

    sqlx::query("UPDATE posts SET score = $1 WHERE id = $2")
        .bind(score)
        .bind(post_id)
        .execute(pool)
        .await
        .map_err(db_err)?;

    Ok(())
}

async fn post_feed_row_to_details(
    pool: &PgPool,
    row: PostFeedRow,
) -> Result<PostWithDetails, (StatusCode, Json<Value>)> {
    let attachments = load_post_attachments(pool, row.id).await?;
    let poll_options = if row.r#type == "poll" {
        load_poll_options(pool, row.id).await?
    } else {
        None
    };

    Ok(PostWithDetails {
        id: row.id,
        publisher_id: row.publisher_id,
        publisher_name: row.publisher_name,
        publisher_avatar: row.publisher_avatar,
        publisher_type: row.publisher_type,
        is_verified: row.is_verified,
        r#type: row.r#type,
        content: row.content,
        visibility: row.visibility,
        is_pinned: row.is_pinned,
        attachments,
        poll_options,
        poll_expires_at: row.poll_expires_at,
        likes_count: row.likes_count,
        comments_count: row.comments_count,
        shares_count: row.shares_count,
        created_at: row.created_at,
        liked_by_me: row.liked_by_me,
        saved_by_me: row.saved_by_me,
        voted_option: row.voted_option.map(|id| id.to_string()),
    })
}

const POST_FEED_SELECT: &str = r#"
    SELECT
        p.id,
        p.publisher_id,
        pub.name AS publisher_name,
        pub.avatar_url AS publisher_avatar,
        pub.type AS publisher_type,
        pub.is_verified,
        p.type,
        p.content,
        p.visibility,
        p.is_pinned,
        p.poll_expires_at,
        p.likes_count,
        p.comments_count,
        p.shares_count,
        p.created_at,
        EXISTS(
            SELECT 1 FROM post_likes pl
            WHERE pl.post_id = p.id AND pl.user_id = $1
        ) AS liked_by_me,
        EXISTS(
            SELECT 1 FROM saved_posts sp
            WHERE sp.post_id = p.id AND sp.user_id = $1
        ) AS saved_by_me,
        (
            SELECT pv.option_id FROM poll_votes pv
            WHERE pv.post_id = p.id AND pv.voter_id = $1
        ) AS voted_option
    FROM posts p
    JOIN publishers pub ON p.publisher_id = pub.id
"#;

const POST_VISIBILITY_FILTER: &str = r#"
    AND (
        p.publisher_id = $1
        OR p.visibility = 'public'
        OR (
            p.visibility = 'followers'
            AND EXISTS(
                SELECT 1 FROM follows f
                WHERE f.follower_id = $1 AND f.following_id = p.publisher_id
            )
        )
        OR (
            p.visibility = 'contacts'
            AND pub.type = 'user'
            AND EXISTS(
                SELECT 1 FROM contacts c
                WHERE c.user_id = $2 AND c.contact_id = pub.ref_id
            )
        )
        OR (
            p.visibility = 'channel'
            AND pub.type = 'channel'
            AND EXISTS(
                SELECT 1 FROM follows f
                WHERE f.follower_id = $1 AND f.following_id = p.publisher_id
            )
        )
    )
"#;

const POST_MODERATION_FILTER: &str = r#"
    AND p.is_deleted = FALSE
    AND p.publisher_id NOT IN (
        SELECT blocked_id FROM blocks WHERE blocker_id = $1
    )
    AND p.publisher_id NOT IN (
        SELECT muted_id FROM muted_publishers WHERE user_id = $1
    )
    AND p.id NOT IN (
        SELECT post_id FROM hidden_posts WHERE user_id = $1
    )
"#;

fn comment_row_to_response(row: CommentRow, replies: Vec<CommentResponse>) -> CommentResponse {
    CommentResponse {
        id: row.id.to_string(),
        user_id: row.user_id.to_string(),
        user_name: row.user_name,
        user_avatar: row.user_avatar,
        parent_id: row.parent_id.map(|id| id.to_string()),
        content: row.content,
        likes_count: row.likes_count,
        liked_by_me: row.liked_by_me,
        created_at: row.created_at.to_rfc3339(),
        replies,
    }
}

fn fetch_replies_boxed(
    pool: PgPool,
    post_id: Uuid,
    parent_id: Uuid,
    my_publisher_id: Uuid,
) -> Pin<Box<dyn Future<Output = Result<Vec<CommentResponse>, (StatusCode, Json<Value>)>> + Send>> {
    Box::pin(async move {
        let rows = sqlx::query_as::<_, CommentRow>(
            r#"
            SELECT
                c.id,
                c.user_id,
                pub.name AS user_name,
                pub.avatar_url AS user_avatar,
                c.parent_id,
                c.content,
                c.likes_count,
                EXISTS(
                    SELECT 1 FROM post_comment_likes cl
                    WHERE cl.comment_id = c.id AND cl.user_id = $3
                ) AS liked_by_me,
                c.created_at
            FROM post_comments c
            JOIN publishers pub ON c.user_id = pub.id
            WHERE c.post_id = $1 AND c.parent_id = $2 AND c.is_deleted = FALSE
            ORDER BY c.created_at ASC
            "#,
        )
        .bind(post_id)
        .bind(parent_id)
        .bind(my_publisher_id)
        .fetch_all(&pool)
        .await
        .map_err(db_err)?;

        let mut replies = Vec::new();
        for row in rows {
            let nested =
                fetch_replies_boxed(pool.clone(), post_id, row.id, my_publisher_id).await?;
            replies.push(comment_row_to_response(row, nested));
        }
        Ok(replies)
    })
}

// ============================================================
// Publishers
// ============================================================

pub async fn create_publisher(
    AuthUser(_user_id): AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePublisherRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let publisher = sqlx::query_as::<_, Publisher>(
        r#"
        INSERT INTO publishers (type, ref_id, name, avatar_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, type, ref_id, name, avatar_url, is_verified, created_at
        "#,
    )
    .bind(&payload.r#type)
    .bind(payload.ref_id)
    .bind(&payload.name)
    .bind(&payload.avatar_url)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::CREATED, Json(json!(publisher))))
}

async fn is_following_publisher(
    pool: &PgPool,
    follower_id: Uuid,
    following_id: Uuid,
) -> Result<bool, (StatusCode, Json<Value>)> {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2)",
    )
    .bind(follower_id)
    .bind(following_id)
    .fetch_one(pool)
    .await
    .map_err(db_err)
}

async fn count_followers(
    pool: &PgPool,
    publisher_id: Uuid,
) -> Result<i64, (StatusCode, Json<Value>)> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM follows WHERE following_id = $1")
        .bind(publisher_id)
        .fetch_one(pool)
        .await
        .map_err(db_err)
}

async fn count_following(
    pool: &PgPool,
    publisher_id: Uuid,
) -> Result<i64, (StatusCode, Json<Value>)> {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM follows WHERE follower_id = $1")
        .bind(publisher_id)
        .fetch_one(pool)
        .await
        .map_err(db_err)
}

async fn publisher_with_follow(
    pool: &PgPool,
    p: Publisher,
    my_publisher_id: Uuid,
) -> Result<PublisherWithFollow, (StatusCode, Json<Value>)> {
    let following = is_following_publisher(pool, my_publisher_id, p.id).await?;
    let followers_count = count_followers(pool, p.id).await?;
    let following_count = count_following(pool, p.id).await?;

    let username = sqlx::query_scalar::<_, String>(
        "SELECT username FROM users WHERE id = $1",
    )
    .bind(p.ref_id)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?;

    Ok(PublisherWithFollow::from_publisher(
        p,
        username,
        following,
        followers_count,
        following_count,
    ))
}

pub async fn get_publisher(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let publisher = sqlx::query_as::<_, Publisher>(
        "SELECT id, type, ref_id, name, avatar_url, is_verified, created_at FROM publishers WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?;

    match publisher {
        Some(p) => {
            let response = publisher_with_follow(&pool, p, my_publisher_id).await?;
            Ok(Json(json!(response)))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Publisher not found" })),
        )),
    }
}

pub async fn get_publisher_by_user(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(target_user_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let publisher = ensure_user_publisher_full(&pool, target_user_id).await?;
    let response = publisher_with_follow(&pool, publisher, my_publisher_id).await?;
    Ok(Json(json!(response)))
}

pub async fn get_my_publisher(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let publisher = ensure_user_publisher_full(&pool, user_id).await?;
    let followers_count = count_followers(&pool, publisher.id).await?;
    let following_count = count_following(&pool, publisher.id).await?;

    let username = sqlx::query_scalar::<_, String>(
        "SELECT username FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!(PublisherWithFollow::from_publisher(
        publisher,
        username,
        false,
        followers_count,
        following_count,
    ))))
}

pub async fn list_publisher_posts(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(publisher_id): Path<Uuid>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let (limit, offset) = pagination(&query);

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM publishers WHERE id = $1)",
    )
    .bind(publisher_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Publisher not found" })),
        ));
    }

    let is_own_profile = publisher_id == my_publisher_id;
    let visibility_filter = if is_own_profile {
        String::new()
    } else {
        POST_VISIBILITY_FILTER.to_string()
    };

    let sql = format!(
        r#"
        {POST_FEED_SELECT}
        WHERE p.publisher_id = $3
        {POST_MODERATION_FILTER}
        {visibility_filter}
        ORDER BY p.created_at DESC
        LIMIT $4 OFFSET $5
        "#
    );

    let rows = sqlx::query_as::<_, PostFeedRow>(&sql)
        .bind(my_publisher_id)
        .bind(user_id)
        .bind(publisher_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await
        .map_err(db_err)?;

    let mut posts = Vec::new();
    for row in rows {
        posts.push(post_feed_row_to_details(&pool, row).await?);
    }

    Ok(Json(json!(posts)))
}

// ============================================================
// Stories
// ============================================================

pub async fn list_stories(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let rows = sqlx::query_as::<_, StoryRow>(
        r#"
        SELECT
            s.id,
            s.publisher_id,
            pub.name AS publisher_name,
            pub.avatar_url AS publisher_avatar,
            pub.type AS publisher_type,
            pub.is_verified,
            s.content,
            s.background_color,
            s.font_color,
            s.created_at,
            s.expires_at,
            EXISTS(
                SELECT 1 FROM story_views sv
                WHERE sv.story_id = s.id AND sv.viewer_id = $1
            ) AS viewed
        FROM stories s
        JOIN publishers pub ON s.publisher_id = pub.id
        WHERE s.is_expired = FALSE
          AND s.expires_at > NOW()
          AND (
              s.publisher_id = $1
              OR s.publisher_id IN (
                  SELECT following_id FROM follows WHERE follower_id = $1
              )
          )
        ORDER BY s.publisher_id, s.created_at ASC
        "#,
    )
    .bind(my_publisher_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let mut groups: HashMap<Uuid, StoryGroup> = HashMap::new();

    for row in rows {
        let attachments = load_story_attachments(&pool, row.id).await?;
        let story = StoryWithPublisher {
            id: row.id,
            publisher_id: row.publisher_id,
            publisher_name: row.publisher_name.clone(),
            publisher_avatar: row.publisher_avatar.clone(),
            publisher_type: row.publisher_type.clone(),
            is_verified: row.is_verified,
            content: row.content,
            background_color: row.background_color,
            font_color: row.font_color,
            created_at: row.created_at,
            expires_at: row.expires_at,
            viewed: row.viewed,
            attachments,
        };

        groups
            .entry(row.publisher_id)
            .and_modify(|g| {
                if !story.viewed {
                    g.all_viewed = false;
                }
                g.stories.push(story.clone());
            })
            .or_insert_with(|| StoryGroup {
                publisher_id: row.publisher_id,
                publisher_name: row.publisher_name,
                publisher_avatar: row.publisher_avatar,
                publisher_type: row.publisher_type,
                is_verified: row.is_verified,
                stories: vec![story.clone()],
                all_viewed: story.viewed,
            });
    }

    let mut result: Vec<StoryGroup> = groups.into_values().collect();
    result.sort_by(|a, b| {
        let a_latest = a.stories.last().map(|s| s.created_at);
        let b_latest = b.stories.last().map(|s| s.created_at);
        b_latest.cmp(&a_latest)
    });

    Ok(Json(json!(result)))
}

pub async fn create_story(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<CreateStoryRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let publisher = ensure_user_publisher_full(&pool, user_id).await?;

    let story = sqlx::query_as::<_, Story>(
        r#"
        INSERT INTO stories (publisher_id, content, background_color, font_color)
        VALUES ($1, $2, $3, $4)
        RETURNING id, publisher_id, content, background_color, font_color, is_expired, created_at, expires_at
        "#,
    )
    .bind(my_publisher_id)
    .bind(&payload.content)
    .bind(&payload.background_color)
    .bind(&payload.font_color)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    for (i, att) in payload.attachments.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO story_attachments (story_id, type, url, mime_type, width, height, duration, size, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(story.id)
        .bind(&att.r#type)
        .bind(&att.url)
        .bind(&att.mime_type)
        .bind(att.width)
        .bind(att.height)
        .bind(att.duration)
        .bind(att.size)
        .bind(i as i32)
        .execute(&pool)
        .await
        .map_err(db_err)?;
    }

    let attachments = load_story_attachments(&pool, story.id).await?;
    let response = StoryWithPublisher {
        id: story.id,
        publisher_id: story.publisher_id,
        publisher_name: publisher.name,
        publisher_avatar: publisher.avatar_url,
        publisher_type: publisher.r#type,
        is_verified: publisher.is_verified,
        content: story.content,
        background_color: story.background_color,
        font_color: story.font_color,
        created_at: story.created_at,
        expires_at: story.expires_at,
        viewed: false,
        attachments,
    };

    Ok((StatusCode::CREATED, Json(json!(response))))
}

pub async fn expire_story(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let result = sqlx::query(
        "UPDATE stories SET is_expired = TRUE WHERE id = $1 AND publisher_id = $2",
    )
    .bind(id)
    .bind(my_publisher_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Story not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success" })))
}

pub async fn mark_story_viewed(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    sqlx::query(
        r#"
        INSERT INTO story_views (story_id, viewer_id)
        VALUES ($1, $2)
        ON CONFLICT (story_id, viewer_id) DO NOTHING
        "#,
    )
    .bind(id)
    .bind(my_publisher_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({ "status": "success" })))
}

pub async fn get_publisher_stories(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(publisher_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let rows = sqlx::query_as::<_, StoryRow>(
        r#"
        SELECT
            s.id,
            s.publisher_id,
            pub.name AS publisher_name,
            pub.avatar_url AS publisher_avatar,
            pub.type AS publisher_type,
            pub.is_verified,
            s.content,
            s.background_color,
            s.font_color,
            s.created_at,
            s.expires_at,
            EXISTS(
                SELECT 1 FROM story_views sv
                WHERE sv.story_id = s.id AND sv.viewer_id = $2
            ) AS viewed
        FROM stories s
        JOIN publishers pub ON s.publisher_id = pub.id
        WHERE s.publisher_id = $1
          AND s.is_expired = FALSE
          AND s.expires_at > NOW()
        ORDER BY s.created_at ASC
        "#,
    )
    .bind(publisher_id)
    .bind(my_publisher_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let mut stories = Vec::new();
    for row in rows {
        let attachments = load_story_attachments(&pool, row.id).await?;
        stories.push(StoryWithPublisher {
            id: row.id,
            publisher_id: row.publisher_id,
            publisher_name: row.publisher_name,
            publisher_avatar: row.publisher_avatar,
            publisher_type: row.publisher_type,
            is_verified: row.is_verified,
            content: row.content,
            background_color: row.background_color,
            font_color: row.font_color,
            created_at: row.created_at,
            expires_at: row.expires_at,
            viewed: row.viewed,
            attachments,
        });
    }

    Ok(Json(json!(stories)))
}

// ============================================================
// Posts (Feed)
// ============================================================

pub async fn list_feed(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let (limit, offset) = pagination(&query);

    let sql = format!(
        r#"
        {POST_FEED_SELECT}
        WHERE TRUE
        {POST_MODERATION_FILTER}
        {POST_VISIBILITY_FILTER}
        ORDER BY p.is_pinned DESC, p.score DESC, p.created_at DESC
        LIMIT $3 OFFSET $4
        "#
    );

    let rows = sqlx::query_as::<_, PostFeedRow>(&sql)
        .bind(my_publisher_id)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await
        .map_err(db_err)?;

    let mut posts = Vec::new();
    for row in rows {
        posts.push(post_feed_row_to_details(&pool, row).await?);
    }

    Ok(Json(json!(posts)))
}

pub async fn create_post(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<CreatePostRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let visibility = payload.visibility.unwrap_or_else(|| "contacts".to_string());

    let poll_expires_at = if payload.r#type == "poll" {
        payload
            .poll_duration_hours
            .map(|h| Utc::now() + Duration::hours(i64::from(h)))
    } else {
        None
    };

    let post = sqlx::query_as::<_, Post>(
        r#"
        INSERT INTO posts (publisher_id, type, content, visibility, poll_expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, publisher_id, type, content, visibility, is_pinned, poll_expires_at,
                  likes_count, comments_count, shares_count, score, is_deleted, created_at
        "#,
    )
    .bind(my_publisher_id)
    .bind(&payload.r#type)
    .bind(&payload.content)
    .bind(&visibility)
    .bind(poll_expires_at)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    for (i, att) in payload.attachments.iter().enumerate() {
        sqlx::query(
            r#"
            INSERT INTO post_attachments (post_id, type, url, mime_type, width, height, duration, size, sha256, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            "#,
        )
        .bind(post.id)
        .bind(&att.r#type)
        .bind(&att.url)
        .bind(&att.mime_type)
        .bind(att.width)
        .bind(att.height)
        .bind(att.duration)
        .bind(att.size)
        .bind(&att.sha256)
        .bind(i as i32)
        .execute(&pool)
        .await
        .map_err(db_err)?;
    }

    if payload.r#type == "poll" {
        if let Some(options) = &payload.poll_options {
            for (i, label) in options.iter().enumerate() {
                sqlx::query(
                    "INSERT INTO poll_options (post_id, label, sort_order) VALUES ($1, $2, $3)",
                )
                .bind(post.id)
                .bind(label)
                .bind(i as i32)
                .execute(&pool)
                .await
                .map_err(db_err)?;
            }
        }
    }

    let sql = format!(
        r#"
        {POST_FEED_SELECT}
        WHERE p.id = $3
        "#
    );

    let row = sqlx::query_as::<_, PostFeedRow>(&sql)
        .bind(my_publisher_id)
        .bind(user_id)
        .bind(post.id)
        .fetch_one(&pool)
        .await
        .map_err(db_err)?;

    let details = post_feed_row_to_details(&pool, row).await?;
    Ok((StatusCode::CREATED, Json(json!(details))))
}

pub async fn get_post(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let sql = format!(
        r#"
        {POST_FEED_SELECT}
        WHERE p.id = $3
          AND p.is_deleted = FALSE
        {POST_VISIBILITY_FILTER}
        "#
    );

    let row = sqlx::query_as::<_, PostFeedRow>(&sql)
        .bind(my_publisher_id)
        .bind(user_id)
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?;

    match row {
        Some(r) => {
            let details = post_feed_row_to_details(&pool, r).await?;
            Ok(Json(json!(details)))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Post not found" })),
        )),
    }
}

pub async fn delete_post(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let result = sqlx::query(
        "UPDATE posts SET is_deleted = TRUE WHERE id = $1 AND publisher_id = $2",
    )
    .bind(id)
    .bind(my_publisher_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Post not found" })),
        ));
    }

    Ok(Json(json!({ "status": "success" })))
}

// ============================================================
// Interactions
// ============================================================

pub async fn toggle_like(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2)",
    )
    .bind(id)
    .bind(my_publisher_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let liked = if exists {
        sqlx::query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2")
            .bind(id)
            .bind(my_publisher_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        sqlx::query(
            "UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1",
        )
        .bind(id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        false
    } else {
        sqlx::query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)")
            .bind(id)
            .bind(my_publisher_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        sqlx::query("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        true
    };

    recalculate_post_score(&pool, id).await?;
    Ok(Json(json!({ "liked": liked })))
}

pub async fn list_comments(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let (limit, offset) = pagination(&query);

    let rows = sqlx::query_as::<_, CommentRow>(
        r#"
        SELECT
            c.id,
            c.user_id,
            pub.name AS user_name,
            pub.avatar_url AS user_avatar,
            c.parent_id,
            c.content,
            c.likes_count,
            EXISTS(
                SELECT 1 FROM post_comment_likes cl
                WHERE cl.comment_id = c.id AND cl.user_id = $2
            ) AS liked_by_me,
            c.created_at
        FROM post_comments c
        JOIN publishers pub ON c.user_id = pub.id
        WHERE c.post_id = $1 AND c.parent_id IS NULL AND c.is_deleted = FALSE
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(id)
    .bind(my_publisher_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let mut comments = Vec::new();
    for row in rows {
        let replies = fetch_replies_boxed(pool.clone(), id, row.id, my_publisher_id).await?;
        comments.push(comment_row_to_response(row, replies));
    }

    Ok(Json(json!(comments)))
}

pub async fn add_comment(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<CommentRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let publisher = ensure_user_publisher_full(&pool, user_id).await?;

    let parent_id = if let Some(ref pid) = payload.parent_id {
        Some(Uuid::parse_str(pid).map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid parent_id" })),
            )
        })?)
    } else {
        None
    };

    if let Some(pid) = parent_id {
        let valid = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM post_comments WHERE id = $1 AND post_id = $2 AND is_deleted = FALSE)",
        )
        .bind(pid)
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(db_err)?;

        if !valid {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Parent comment not found" })),
            ));
        }
    }

    let comment = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        r#"
        INSERT INTO post_comments (post_id, user_id, parent_id, content)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        "#,
    )
    .bind(id)
    .bind(my_publisher_id)
    .bind(parent_id)
    .bind(&payload.content)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    sqlx::query("UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(db_err)?;

    recalculate_post_score(&pool, id).await?;

    let response = CommentResponse {
        id: comment.0.to_string(),
        user_id: my_publisher_id.to_string(),
        user_name: publisher.name,
        user_avatar: publisher.avatar_url,
        parent_id: parent_id.map(|p| p.to_string()),
        content: payload.content,
        likes_count: 0,
        liked_by_me: false,
        created_at: comment.1.to_rfc3339(),
        replies: vec![],
    };

    Ok((StatusCode::CREATED, Json(json!(response))))
}

pub async fn delete_comment(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path((post_id, comment_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let result = sqlx::query(
        r#"
        UPDATE post_comments
        SET is_deleted = TRUE, updated_at = NOW()
        WHERE id = $1 AND post_id = $2 AND user_id = $3 AND is_deleted = FALSE
        "#,
    )
    .bind(comment_id)
    .bind(post_id)
    .bind(my_publisher_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    if result.rows_affected() == 0 {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Comment not found" })),
        ));
    }

    sqlx::query(
        "UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1",
    )
    .bind(post_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    recalculate_post_score(&pool, post_id).await?;

    Ok(Json(json!({ "status": "success" })))
}

pub async fn toggle_comment_like(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path((_post_id, comment_id)): Path<(Uuid, Uuid)>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM post_comment_likes WHERE comment_id = $1 AND user_id = $2)",
    )
    .bind(comment_id)
    .bind(my_publisher_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let liked = if exists {
        sqlx::query(
            "DELETE FROM post_comment_likes WHERE comment_id = $1 AND user_id = $2",
        )
        .bind(comment_id)
        .bind(my_publisher_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        sqlx::query(
            "UPDATE post_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1",
        )
        .bind(comment_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        false
    } else {
        sqlx::query(
            "INSERT INTO post_comment_likes (comment_id, user_id) VALUES ($1, $2)",
        )
        .bind(comment_id)
        .bind(my_publisher_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        sqlx::query("UPDATE post_comments SET likes_count = likes_count + 1 WHERE id = $1")
            .bind(comment_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        true
    };

    Ok(Json(json!({ "liked": liked })))
}

pub async fn share_post(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ShareRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let target_id = if let Some(ref tid) = payload.target_id {
        Some(Uuid::parse_str(tid).map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid target_id" })),
            )
        })?)
    } else {
        None
    };

    sqlx::query(
        r#"
        INSERT INTO post_shares (post_id, user_id, share_target, target_id)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(id)
    .bind(my_publisher_id)
    .bind(&payload.share_target)
    .bind(target_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    sqlx::query("UPDATE posts SET shares_count = shares_count + 1 WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(db_err)?;

    recalculate_post_score(&pool, id).await?;

    Ok(Json(json!({ "status": "success" })))
}

pub async fn vote_poll(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(payload): Json<PollVoteRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let option_id = Uuid::parse_str(&payload.option_id).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid option_id" })),
        )
    })?;

    let valid = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM poll_options WHERE id = $1 AND post_id = $2)",
    )
    .bind(option_id)
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    if !valid {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Poll option not found" })),
        ));
    }

    let existing = sqlx::query_scalar::<_, Option<Uuid>>(
        "SELECT option_id FROM poll_votes WHERE post_id = $1 AND voter_id = $2",
    )
    .bind(id)
    .bind(my_publisher_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .flatten();

    if let Some(old_option_id) = existing {
        if old_option_id == option_id {
            return Ok(Json(json!({ "status": "success" })));
        }
        sqlx::query(
            "UPDATE poll_votes SET option_id = $1, voted_at = NOW() WHERE post_id = $2 AND voter_id = $3",
        )
        .bind(option_id)
        .bind(id)
        .bind(my_publisher_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        sqlx::query("UPDATE poll_options SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = $1")
            .bind(old_option_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        sqlx::query("UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = $1")
            .bind(option_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
    } else {
        sqlx::query(
            "INSERT INTO poll_votes (post_id, option_id, voter_id) VALUES ($1, $2, $3)",
        )
        .bind(id)
        .bind(option_id)
        .bind(my_publisher_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        sqlx::query("UPDATE poll_options SET votes_count = votes_count + 1 WHERE id = $1")
            .bind(option_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
    }

    Ok(Json(json!({ "status": "success" })))
}

pub async fn toggle_save(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM saved_posts WHERE post_id = $1 AND user_id = $2)",
    )
    .bind(id)
    .bind(my_publisher_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let saved = if exists {
        sqlx::query("DELETE FROM saved_posts WHERE post_id = $1 AND user_id = $2")
            .bind(id)
            .bind(my_publisher_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        false
    } else {
        sqlx::query("INSERT INTO saved_posts (post_id, user_id) VALUES ($1, $2)")
            .bind(id)
            .bind(my_publisher_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        true
    };

    Ok(Json(json!({ "saved": saved })))
}

pub async fn hide_post(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    sqlx::query(
        r#"
        INSERT INTO hidden_posts (user_id, post_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, post_id) DO NOTHING
        "#,
    )
    .bind(my_publisher_id)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!({ "status": "success" })))
}

// ============================================================
// Saved Posts
// ============================================================

pub async fn list_saved_posts(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let (limit, offset) = pagination(&query);

    let sql = format!(
        r#"
        {POST_FEED_SELECT}
        JOIN saved_posts sav ON sav.post_id = p.id AND sav.user_id = $1
        WHERE p.is_deleted = FALSE
        ORDER BY sav.created_at DESC
        LIMIT $3 OFFSET $4
        "#
    );

    let rows = sqlx::query_as::<_, PostFeedRow>(&sql)
        .bind(my_publisher_id)
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&pool)
        .await
        .map_err(db_err)?;

    let mut posts = Vec::new();
    for row in rows {
        posts.push(post_feed_row_to_details(&pool, row).await?);
    }

    Ok(Json(json!(posts)))
}

// ============================================================
// Follow
// ============================================================

async fn do_toggle_follow(
    pool: &PgPool,
    my_publisher_id: Uuid,
    target_publisher_id: Uuid,
) -> Result<bool, (StatusCode, Json<Value>)> {
    if target_publisher_id == my_publisher_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot follow yourself" })),
        ));
    }

    let exists = is_following_publisher(pool, my_publisher_id, target_publisher_id).await?;

    if exists {
        sqlx::query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2")
            .bind(my_publisher_id)
            .bind(target_publisher_id)
            .execute(pool)
            .await
            .map_err(db_err)?;
        Ok(false)
    } else {
        let target_exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM publishers WHERE id = $1)",
        )
        .bind(target_publisher_id)
        .fetch_one(pool)
        .await
        .map_err(db_err)?;

        if !target_exists {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Publisher not found" })),
            ));
        }

        sqlx::query("INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)")
            .bind(my_publisher_id)
            .bind(target_publisher_id)
            .execute(pool)
            .await
            .map_err(db_err)?;
        Ok(true)
    }
}

pub async fn toggle_follow(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(publisher_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let following = do_toggle_follow(&pool, my_publisher_id, publisher_id).await?;
    Ok(Json(json!({ "following": following })))
}

pub async fn toggle_follow_by_user(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(target_user_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;
    let target_publisher_id = ensure_user_publisher(&pool, target_user_id).await?;
    let following = do_toggle_follow(&pool, my_publisher_id, target_publisher_id).await?;
    Ok(Json(json!({ "following": following })))
}

pub async fn list_following(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let publishers = sqlx::query_as::<_, Publisher>(
        r#"
        SELECT pub.id, pub.type, pub.ref_id, pub.name, pub.avatar_url, pub.is_verified, pub.created_at
        FROM follows f
        JOIN publishers pub ON f.following_id = pub.id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(my_publisher_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!(publishers)))
}

pub async fn list_followers(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let publishers = sqlx::query_as::<_, Publisher>(
        r#"
        SELECT pub.id, pub.type, pub.ref_id, pub.name, pub.avatar_url, pub.is_verified, pub.created_at
        FROM follows f
        JOIN publishers pub ON f.follower_id = pub.id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(my_publisher_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    Ok(Json(json!(publishers)))
}

// ============================================================
// Moderation
// ============================================================

pub async fn toggle_block(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(publisher_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    if publisher_id == my_publisher_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot block yourself" })),
        ));
    }

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2)",
    )
    .bind(my_publisher_id)
    .bind(publisher_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let blocked = if exists {
        sqlx::query("DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2")
            .bind(my_publisher_id)
            .bind(publisher_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        false
    } else {
        sqlx::query("INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)")
            .bind(my_publisher_id)
            .bind(publisher_id)
            .execute(&pool)
            .await
            .map_err(db_err)?;
        true
    };

    Ok(Json(json!({ "blocked": blocked })))
}

pub async fn toggle_mute(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Path(publisher_id): Path<Uuid>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    if publisher_id == my_publisher_id {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Cannot mute yourself" })),
        ));
    }

    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM muted_publishers WHERE user_id = $1 AND muted_id = $2)",
    )
    .bind(my_publisher_id)
    .bind(publisher_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let muted = if exists {
        sqlx::query(
            "DELETE FROM muted_publishers WHERE user_id = $1 AND muted_id = $2",
        )
        .bind(my_publisher_id)
        .bind(publisher_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        false
    } else {
        sqlx::query(
            "INSERT INTO muted_publishers (user_id, muted_id) VALUES ($1, $2)",
        )
        .bind(my_publisher_id)
        .bind(publisher_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        true
    };

    Ok(Json(json!({ "muted": muted })))
}

pub async fn create_report(
    AuthUser(user_id): AuthUser,
    State(pool): State<PgPool>,
    Json(payload): Json<ReportRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let my_publisher_id = ensure_user_publisher(&pool, user_id).await?;

    let source_id = Uuid::parse_str(&payload.source_id).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Invalid source_id" })),
        )
    })?;

    sqlx::query(
        r#"
        INSERT INTO reports (reporter_id, source_type, source_id, reason, description)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(my_publisher_id)
    .bind(&payload.source_type)
    .bind(source_id)
    .bind(&payload.reason)
    .bind(&payload.description)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::CREATED, Json(json!({ "status": "success" }))))
}
