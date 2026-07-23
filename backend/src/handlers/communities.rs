use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::models::community::{
    Community, CommunityChannel, CommunityComment, CommunityEvent,
    CommunityInvite, CommunityMember, CommunityMessage, CommunityPost, CreateChannelRequest,
    CreateCommentRequest, CreateCommunityRequest, CreateEventRequest, CreateInviteRequest,
    CreatePostRequest, GetCommunityMessagesQuery, GetCommentsQuery, GetEventsQuery,
    GetPostsQuery, JoinByCodeRequest, RsvpEventRequest, SendCommunityMessageRequest,
    UpdateChannelRequest, UpdateCommentRequest, UpdateCommunityRequest, UpdateEventRequest,
    UpdateMemberRoleRequest, UpdatePostRequest,
};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_communities).post(create_community))
        .route("/discover", get(discover_communities))
        .route("/join", post(join_by_code))
        .route(
            "/:id",
            get(get_community)
                .patch(update_community)
                .delete(delete_community),
        )
        .route("/:id/join", post(join_community))
        .route("/:id/leave", post(leave_community))
        .route("/:id/members", get(list_members))
        .route(
            "/:id/members/:user_id/role",
            patch(update_member_role),
        )
        .route("/:id/members/:user_id", delete(remove_member))
        .route("/:id/members/:user_id/mute", post(toggle_mute_member))
        .route(
            "/:id/channels",
            get(list_channels).post(create_channel),
        )
        .route(
            "/:id/channels/:channel_id",
            patch(update_channel).delete(delete_channel),
        )
        .route(
            "/:id/channels/:channel_id/messages",
            get(list_community_messages).post(send_community_message),
        )
        .route(
            "/:id/posts",
            get(list_posts).post(create_post),
        )
        .route(
            "/:id/posts/:post_id",
            get(get_post).patch(update_post).delete(delete_post),
        )
        .route(
            "/:id/posts/:post_id/comments",
            get(list_comments).post(create_comment),
        )
        .route(
            "/:id/posts/:post_id/comments/:comment_id",
            patch(update_comment).delete(delete_comment),
        )
        .route(
            "/:id/events",
            get(list_events).post(create_event),
        )
        .route(
            "/:id/events/:event_id",
            get(get_event).patch(update_event).delete(delete_event),
        )
        .route(
            "/:id/events/:event_id/rsvp",
            post(rsvp_event),
        )
        .route(
            "/:id/invites",
            get(list_invites).post(create_invite),
        )
        .route(
            "/:id/invites/:invite_id",
            delete(revoke_invite),
        )
        .route(
            "/:id/invites/:invite_id/accept",
            post(accept_invite),
        )
        .route(
            "/:id/invites/:invite_id/reject",
            post(reject_invite),
        )
        .route(
            "/:id/upload",
            post(upload_community_file),
        )
}

pub async fn list_communities(
    State(pool): State<PgPool>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(50);
    let offset = (page - 1) * limit;

    let communities = sqlx::query_as::<_, Community>(
        "SELECT * FROM communities WHERE visibility = 'PUBLIC' ORDER BY member_count DESC LIMIT $1 OFFSET $2",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch communities" })),
        )
    })?;

    Ok(Json(json!({ "communities": communities })))
}

pub async fn get_community(
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let community = sqlx::query_as::<_, Community>(
        "SELECT * FROM communities WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "community not found" })),
        )
    })?;

    Ok(Json(json!({ "community": community })))
}

pub async fn create_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<CreateCommunityRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if body.name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "community name is required" })),
        ));
    }

    let visibility = body.visibility.unwrap_or_else(|| "PUBLIC".to_string());
    if !["PUBLIC", "PRIVATE", "INVITE_ONLY"].contains(&visibility.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid visibility value" })),
        ));
    }

    let community = sqlx::query_as::<_, Community>(
        "INSERT INTO communities (name, description, icon_url, banner_url, owner_id, visibility, category) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(body.name.trim())
    .bind(body.description)
    .bind(body.icon_url)
    .bind(body.banner_url)
    .bind(auth.0)
    .bind(&visibility)
    .bind(body.category)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create community" })),
        )
    })?;

    // Add owner as member
    sqlx::query(
        "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'OWNER')",
    )
    .bind(community.id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to add owner as member" })),
        )
    })?;

    // Create default channels
    let default_channels = vec![
        ("Geral", "CHAT"),
        ("Avisos", "ANNOUNCEMENTS"),
    ];

    for (name, channel_type) in default_channels {
        sqlx::query(
            "INSERT INTO community_channels (community_id, name, type, position) VALUES ($1, $2, $3, $4)",
        )
        .bind(community.id)
        .bind(name)
        .bind(channel_type)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to create default channels" })),
            )
        })?;
    }

    Ok(Json(json!({ "community": community })))
}

pub async fn update_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCommunityRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if user is owner or admin
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.role != "OWNER" && member.role != "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner or admin can update community" })),
        ));
    }

    // Build update query
    let mut updates = Vec::new();
    let mut param_count = 1;

    if body.name.is_some() {
        updates.push(format!("name = ${}", param_count));
        param_count += 1;
    }
    if body.description.is_some() {
        updates.push(format!("description = ${}", param_count));
        param_count += 1;
    }
    if body.icon_url.is_some() {
        updates.push(format!("icon_url = ${}", param_count));
        param_count += 1;
    }
    if body.banner_url.is_some() {
        updates.push(format!("banner_url = ${}", param_count));
        param_count += 1;
    }
    if body.visibility.is_some() {
        updates.push(format!("visibility = ${}", param_count));
        param_count += 1;
    }
    if body.category.is_some() {
        updates.push(format!("category = ${}", param_count));
        param_count += 1;
    }

    if updates.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "no fields to update" })),
        ));
    }

    updates.push(format!("updated_at = NOW()"));

    let query = format!(
        "UPDATE communities SET {} WHERE id = ${} RETURNING *",
        updates.join(", "),
        param_count
    );

    let mut sqlx_query = sqlx::query_as::<_, Community>(&query);

    if let Some(name) = body.name {
        sqlx_query = sqlx_query.bind(name);
    }
    if let Some(description) = body.description {
        sqlx_query = sqlx_query.bind(description);
    }
    if let Some(icon_url) = body.icon_url {
        sqlx_query = sqlx_query.bind(icon_url);
    }
    if let Some(banner_url) = body.banner_url {
        sqlx_query = sqlx_query.bind(banner_url);
    }
    if let Some(visibility) = body.visibility {
        sqlx_query = sqlx_query.bind(visibility);
    }
    if let Some(category) = body.category {
        sqlx_query = sqlx_query.bind(category);
    }

    sqlx_query = sqlx_query.bind(id);

    let community = sqlx_query
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to update community" })),
            )
        })?;

    Ok(Json(json!({ "community": community })))
}

pub async fn delete_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if user is owner
    let community = sqlx::query_as::<_, Community>(
        "SELECT * FROM communities WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "community not found" })),
        )
    })?;

    if community.owner_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the owner can delete the community" })),
        ));
    }

    sqlx::query("DELETE FROM communities WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to delete community" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok" })))
}

pub async fn join_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if community exists
    sqlx::query_as::<_, Community>(
        "SELECT * FROM communities WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "community not found" })),
        )
    })?;

    // Check if already a member
    let existing = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if existing.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "already a member of this community" })),
        ));
    }

    // Add as member
    sqlx::query(
        "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'MEMBER')",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to join community" })),
        )
    })?;

    // Update member count
    sqlx::query(
        "UPDATE communities SET member_count = member_count + 1 WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to update member count" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok", "message": "joined community" })))
}

pub async fn leave_community(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if user is member
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    // Owner cannot leave
    if member.role == "OWNER" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "owner cannot leave the community. Transfer ownership or delete it." })),
        ));
    }

    sqlx::query(
        "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to leave community" })),
        )
    })?;

    // Update member count
    sqlx::query(
        "UPDATE communities SET member_count = member_count - 1 WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to update member count" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok", "message": "left community" })))
}

pub async fn list_members(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if user is member
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let members = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 ORDER BY cm.joined_at ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch members" })),
        )
    })?;

    Ok(Json(json!({ "members": members })))
}

pub async fn update_member_role(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateMemberRoleRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if requester is owner or admin
    let requester = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if requester.role != "OWNER" && requester.role != "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner or admin can update member roles" })),
        ));
    }

    // Validate new role
    let valid_roles = ["ADMIN", "MODERATOR", "MEMBER"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid role. Valid roles: ADMIN, MODERATOR, MEMBER" })),
        ));
    }

    // Admin can only assign MODERATOR or MEMBER
    if requester.role == "ADMIN" && body.role == "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner can assign ADMIN role" })),
        ));
    }

    // Check if target is a member
    let target = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "user is not a member of this community" })),
        )
    })?;

    // Cannot change owner's role
    if target.role == "OWNER" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "cannot change the owner's role" })),
        ));
    }

    sqlx::query(
        "UPDATE community_members SET role = $1 WHERE community_id = $2 AND user_id = $3",
    )
    .bind(&body.role)
    .bind(id)
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to update member role" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok", "role": body.role })))
}

pub async fn remove_member(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if requester has permission
    let requester = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if requester.role != "OWNER" && requester.role != "ADMIN" && requester.role != "MODERATOR" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you don't have permission to remove members" })),
        ));
    }

    // Check if target is a member
    let target = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "user is not a member of this community" })),
        )
    })?;

    // Cannot remove owner
    if target.role == "OWNER" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "cannot remove the owner" })),
        ));
    }

    // Moderator cannot remove admin
    if requester.role == "MODERATOR" && target.role == "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "moderators cannot remove admins" })),
        ));
    }

    // User can remove themselves
    if user_id != auth.0 && requester.role == "MEMBER" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "members cannot remove other members" })),
        ));
    }

    sqlx::query(
        "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to remove member" })),
        )
    })?;

    // Update member count
    sqlx::query(
        "UPDATE communities SET member_count = member_count - 1 WHERE id = $1",
    )
    .bind(id)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to update member count" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok", "message": "member removed" })))
}

pub async fn list_channels(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if user is member
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let channels = sqlx::query_as::<_, CommunityChannel>(
        "SELECT * FROM community_channels WHERE community_id = $1 ORDER BY position ASC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch channels" })),
        )
    })?;

    Ok(Json(json!({ "channels": channels })))
}

pub async fn create_channel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateChannelRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check if user is owner or admin
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.role != "OWNER" && member.role != "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner or admin can create channels" })),
        ));
    }

    if body.name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "channel name is required" })),
        ));
    }

    let channel_type = body.r#type.unwrap_or_else(|| "CHAT".to_string());
    let position = body.position.unwrap_or(0);

    let channel = sqlx::query_as::<_, CommunityChannel>(
        "INSERT INTO community_channels (community_id, name, type, description, position) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    )
    .bind(id)
    .bind(body.name.trim())
    .bind(&channel_type)
    .bind(body.description)
    .bind(position)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create channel" })),
        )
    })?;

    Ok(Json(json!({ "channel": channel })))
}

pub async fn discover_communities(
    State(pool): State<PgPool>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let communities = sqlx::query_as::<_, Community>(
        "SELECT * FROM communities WHERE visibility = 'PUBLIC' ORDER BY member_count DESC LIMIT 20",
    )
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch communities" })),
        )
    })?;

    // Group by category
    let mut categories: std::collections::HashMap<String, Vec<Community>> =
        std::collections::HashMap::new();

    for community in communities {
        let category = community
            .category
            .clone()
            .unwrap_or_else(|| "Geral".to_string());
        categories.entry(category).or_default().push(community);
    }

    Ok(Json(json!({ "categories": categories })))
}

pub async fn update_channel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, channel_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateChannelRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.role != "OWNER" && member.role != "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner or admin can update channels" })),
        ));
    }

    sqlx::query_as::<_, CommunityChannel>(
        "SELECT * FROM community_channels WHERE id = $1 AND community_id = $2",
    )
    .bind(channel_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "channel not found" })),
        )
    })?;

    let mut updates = Vec::new();
    let mut param_count = 1;

    if body.name.is_some() {
        updates.push(format!("name = ${}", param_count));
        param_count += 1;
    }
    if body.description.is_some() {
        updates.push(format!("description = ${}", param_count));
        param_count += 1;
    }
    if body.position.is_some() {
        updates.push(format!("position = ${}", param_count));
        param_count += 1;
    }

    if updates.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "no fields to update" })),
        ));
    }

    let query = format!(
        "UPDATE community_channels SET {} WHERE id = ${} AND community_id = ${} RETURNING *",
        updates.join(", "),
        param_count,
        param_count + 1
    );

    let mut sqlx_query = sqlx::query_as::<_, CommunityChannel>(&query);

    if let Some(name) = body.name {
        sqlx_query = sqlx_query.bind(name);
    }
    if let Some(description) = body.description {
        sqlx_query = sqlx_query.bind(description);
    }
    if let Some(position) = body.position {
        sqlx_query = sqlx_query.bind(position);
    }

    sqlx_query = sqlx_query.bind(channel_id).bind(id);

    let updated = sqlx_query
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to update channel" })),
            )
        })?;

    Ok(Json(json!({ "channel": updated })))
}

pub async fn delete_channel(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, channel_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.role != "OWNER" && member.role != "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner or admin can delete channels" })),
        ));
    }

    let channel = sqlx::query_as::<_, CommunityChannel>(
        "SELECT * FROM community_channels WHERE id = $1 AND community_id = $2",
    )
    .bind(channel_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "channel not found" })),
        )
    })?;

    // Prevent deleting the last channel
    let channel_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM community_channels WHERE community_id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if channel_count.0 <= 1 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "cannot delete the last channel" })),
        ));
    }

    sqlx::query("DELETE FROM community_channels WHERE id = $1 AND community_id = $2")
        .bind(channel_id)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to delete channel" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "channel_id": channel.id })))
}

pub async fn send_community_message(
    State(pool): State<PgPool>,
    State(ws_state): State<crate::ws::WsState>,
    auth: AuthUser,
    Path((id, channel_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<SendCommunityMessageRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let has_content = body.content.as_deref().map(|c| !c.trim().is_empty()).unwrap_or(false);
    let has_image = body.image_url.as_deref().map(|i| !i.is_empty()).unwrap_or(false);

    if !has_content && !has_image {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "message content or image is required" })),
        ));
    }

    // Check membership
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.muted {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are muted in this community" })),
        ));
    }

    // Check channel exists and belongs to community
    let _channel = sqlx::query_as::<_, CommunityChannel>(
        "SELECT * FROM community_channels WHERE id = $1 AND community_id = $2",
    )
    .bind(channel_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "channel not found" })),
        )
    })?;

    let msg = sqlx::query_as::<_, CommunityMessage>(
        "INSERT INTO community_messages (channel_id, community_id, sender_id, content, image_url, msg_type)
         VALUES ($1, $2, $3, $4, $5, 'TEXT')
         RETURNING
            id, channel_id, community_id, sender_id,
            (SELECT username FROM users WHERE id = $3) AS sender_username,
            (SELECT avatar_url FROM users WHERE id = $3) AS sender_avatar_url,
            content, image_url, msg_type, deleted_for_everyone, deleted_at, created_at",
    )
    .bind(channel_id)
    .bind(id)
    .bind(auth.0)
    .bind(body.content.as_deref().unwrap_or(""))
    .bind(&body.image_url)
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to send community message: {:?}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to send message" })),
        )
    })?;

    // Broadcast via WebSocket using the channel_id as room key
    ws_state
        .broadcast(channel_id, &serde_json::to_string(&json!({"type": "new_community_message", "message": msg})).unwrap())
        .await;

    Ok(Json(json!({ "message": msg })))
}

pub async fn list_community_messages(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, channel_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<GetCommunityMessagesQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    // Check membership
    let is_member: Option<(Uuid,)> = sqlx::query_as(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    // Check channel exists
    let _channel = sqlx::query_as::<_, CommunityChannel>(
        "SELECT * FROM community_channels WHERE id = $1 AND community_id = $2",
    )
    .bind(channel_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "channel not found" })),
        )
    })?;

    let limit = query.limit.unwrap_or(50).min(100);

    let messages = if let Some(before) = query.before {
        sqlx::query_as::<_, CommunityMessage>(
            "SELECT cm.id, cm.channel_id, cm.community_id, cm.sender_id,
                    u.username AS sender_username, u.avatar_url AS sender_avatar_url,
                    cm.content, cm.image_url, cm.msg_type, cm.deleted_for_everyone, cm.deleted_at, cm.created_at
             FROM community_messages cm
             JOIN users u ON u.id = cm.sender_id
             WHERE cm.channel_id = $1 AND cm.community_id = $2 AND cm.created_at < $3
             ORDER BY cm.created_at DESC
             LIMIT $4",
        )
        .bind(channel_id)
        .bind(id)
        .bind(before)
        .bind(limit)
        .fetch_all(&pool)
        .await
    } else {
        sqlx::query_as::<_, CommunityMessage>(
            "SELECT cm.id, cm.channel_id, cm.community_id, cm.sender_id,
                    u.username AS sender_username, u.avatar_url AS sender_avatar_url,
                    cm.content, cm.image_url, cm.msg_type, cm.deleted_for_everyone, cm.deleted_at, cm.created_at
             FROM community_messages cm
             JOIN users u ON u.id = cm.sender_id
             WHERE cm.channel_id = $1 AND cm.community_id = $2
             ORDER BY cm.created_at DESC
             LIMIT $3",
        )
        .bind(channel_id)
        .bind(id)
        .bind(limit)
        .fetch_all(&pool)
        .await
    }
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch messages" })),
        )
    })?;

    Ok(Json(json!({ "messages": messages })))
}

pub async fn toggle_mute_member(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let requester = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if requester.role != "OWNER" && requester.role != "ADMIN" && requester.role != "MODERATOR" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you don't have permission to mute members" })),
        ));
    }

    let target = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "user is not a member of this community" })),
        )
    })?;

    if target.role == "OWNER" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "cannot mute the owner" })),
        ));
    }

    if requester.role == "MODERATOR" && target.role == "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "moderators cannot mute admins" })),
        ));
    }

    let new_muted = !target.muted;
    sqlx::query("UPDATE community_members SET muted = $1 WHERE community_id = $2 AND user_id = $3")
        .bind(new_muted)
        .bind(id)
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to update mute status" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "muted": new_muted })))
}

pub async fn list_posts(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(query): Query<GetPostsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let limit = query.limit.unwrap_or(30).min(100);

    let posts = if let Some(before) = query.before {
        if let Some(channel_id) = query.channel_id {
            sqlx::query_as::<_, CommunityPost>(
                "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                        u.username AS author_username, u.avatar_url AS author_avatar_url,
                        cp.title, cp.content, cp.pinned, cp.locked,
                        (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                        cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
                 FROM community_posts cp
                 JOIN users u ON u.id = cp.author_id
                 WHERE cp.community_id = $1 AND cp.channel_id = $2 AND cp.created_at < $3
                 ORDER BY cp.pinned DESC, cp.created_at DESC
                 LIMIT $4",
            )
            .bind(id)
            .bind(channel_id)
            .bind(before)
            .bind(limit)
            .fetch_all(&pool)
            .await
        } else {
            sqlx::query_as::<_, CommunityPost>(
                "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                        u.username AS author_username, u.avatar_url AS author_avatar_url,
                        cp.title, cp.content, cp.pinned, cp.locked,
                        (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                        cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
                 FROM community_posts cp
                 JOIN users u ON u.id = cp.author_id
                 WHERE cp.community_id = $1 AND cp.created_at < $2
                 ORDER BY cp.pinned DESC, cp.created_at DESC
                 LIMIT $3",
            )
            .bind(id)
            .bind(before)
            .bind(limit)
            .fetch_all(&pool)
            .await
        }
    } else if let Some(channel_id) = query.channel_id {
        sqlx::query_as::<_, CommunityPost>(
            "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                    u.username AS author_username, u.avatar_url AS author_avatar_url,
                    cp.title, cp.content, cp.pinned, cp.locked,
                    (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                    cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
             FROM community_posts cp
             JOIN users u ON u.id = cp.author_id
             WHERE cp.community_id = $1 AND cp.channel_id = $2
             ORDER BY cp.pinned DESC, cp.created_at DESC
             LIMIT $3",
        )
        .bind(id)
        .bind(channel_id)
        .bind(limit)
        .fetch_all(&pool)
        .await
    } else {
        sqlx::query_as::<_, CommunityPost>(
            "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                    u.username AS author_username, u.avatar_url AS author_avatar_url,
                    cp.title, cp.content, cp.pinned, cp.locked,
                    (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                    cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
             FROM community_posts cp
             JOIN users u ON u.id = cp.author_id
             WHERE cp.community_id = $1
             ORDER BY cp.pinned DESC, cp.created_at DESC
             LIMIT $2",
        )
        .bind(id)
        .bind(limit)
        .fetch_all(&pool)
        .await
    }
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch posts" })),
        )
    })?;

    Ok(Json(json!({ "posts": posts })))
}

pub async fn create_post(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreatePostRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.muted {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are muted in this community" })),
        ));
    }

    if body.title.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "post title is required" })),
        ));
    }

    if body.content.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "post content is required" })),
        ));
    }

    // Validate channel belongs to community if provided
    if let Some(channel_id) = body.channel_id {
        let ch = sqlx::query_as::<_, CommunityChannel>(
            "SELECT * FROM community_channels WHERE id = $1 AND community_id = $2",
        )
        .bind(channel_id)
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "database error" })),
            )
        })?;

        if ch.is_none() {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "channel not found" })),
            ));
        }
    }

    let post = sqlx::query_as::<_, CommunityPost>(
        "INSERT INTO community_posts (community_id, channel_id, author_id, title, content)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, community_id, channel_id, author_id,
                   (SELECT username FROM users WHERE id = $3) AS author_username,
                   (SELECT avatar_url FROM users WHERE id = $3) AS author_avatar_url,
                   title, content, pinned, locked, 0 AS comment_count,
                   deleted_for_everyone, deleted_at, created_at, updated_at",
    )
    .bind(id)
    .bind(body.channel_id)
    .bind(auth.0)
    .bind(body.title.trim())
    .bind(body.content.trim())
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create post" })),
        )
    })?;

    Ok(Json(json!({ "post": post })))
}

pub async fn get_post(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let post = sqlx::query_as::<_, CommunityPost>(
        "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cp.title, cp.content, cp.pinned, cp.locked,
                (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
         FROM community_posts cp
         JOIN users u ON u.id = cp.author_id
         WHERE cp.id = $1 AND cp.community_id = $2",
    )
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "post not found" })),
        )
    })?;

    Ok(Json(json!({ "post": post })))
}

pub async fn update_post(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdatePostRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let post = sqlx::query_as::<_, CommunityPost>(
        "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cp.title, cp.content, cp.pinned, cp.locked,
                (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
         FROM community_posts cp
         JOIN users u ON u.id = cp.author_id
         WHERE cp.id = $1 AND cp.community_id = $2",
    )
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "post not found" })),
        )
    })?;

    let is_author = post.author_id == auth.0;

    if !is_author {
        let member = sqlx::query_as::<_, CommunityMember>(
            "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
        )
        .bind(id)
        .bind(auth.0)
        .fetch_optional(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "database error" })),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "you are not a member of this community" })),
            )
        })?;

        let is_admin = member.role == "OWNER" || member.role == "ADMIN";
        let is_pinning_or_locking = body.pinned.is_some() || body.locked.is_some();

        if is_pinning_or_locking && !is_admin {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "only owner or admin can pin/lock posts" })),
            ));
        }

        if !is_admin {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "only the author can edit this post" })),
            ));
        }
    }

    let mut updates = Vec::new();
    let mut param_count = 1;

    if body.title.is_some() {
        updates.push(format!("title = ${}", param_count));
        param_count += 1;
    }
    if body.content.is_some() {
        updates.push(format!("content = ${}", param_count));
        param_count += 1;
    }
    if body.pinned.is_some() {
        updates.push(format!("pinned = ${}", param_count));
        param_count += 1;
    }
    if body.locked.is_some() {
        updates.push(format!("locked = ${}", param_count));
        param_count += 1;
    }

    if updates.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "no fields to update" })),
        ));
    }

    updates.push("updated_at = NOW()".to_string());

    let query = format!(
        "UPDATE community_posts SET {} WHERE id = ${} AND community_id = ${} RETURNING *",
        updates.join(", "),
        param_count,
        param_count + 1
    );

    let mut sqlx_query = sqlx::query_as::<_, CommunityPost>(&query);

    if let Some(title) = body.title {
        sqlx_query = sqlx_query.bind(title);
    }
    if let Some(content) = body.content {
        sqlx_query = sqlx_query.bind(content);
    }
    if let Some(pinned) = body.pinned {
        sqlx_query = sqlx_query.bind(pinned);
    }
    if let Some(locked) = body.locked {
        sqlx_query = sqlx_query.bind(locked);
    }

    sqlx_query = sqlx_query.bind(post_id).bind(id);

    let updated = sqlx_query
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to update post" })),
            )
        })?;

    Ok(Json(json!({ "post": updated })))
}

pub async fn delete_post(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let post = sqlx::query_as::<_, CommunityPost>(
        "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cp.title, cp.content, cp.pinned, cp.locked,
                (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
         FROM community_posts cp
         JOIN users u ON u.id = cp.author_id
         WHERE cp.id = $1 AND cp.community_id = $2",
    )
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "post not found" })),
        )
    })?;

    let is_author = post.author_id == auth.0;
    if !is_author {
        let member = sqlx::query_as::<_, CommunityMember>(
            "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
        )
        .bind(id)
        .bind(auth.0)
        .fetch_optional(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "database error" })),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "you are not a member of this community" })),
            )
        })?;

        if member.role != "OWNER" && member.role != "ADMIN" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "only the author, owner, or admin can delete this post" })),
            ));
        }
    }

    sqlx::query("DELETE FROM community_posts WHERE id = $1 AND community_id = $2")
        .bind(post_id)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to delete post" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "post_id": post_id })))
}

pub async fn list_comments(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id)): Path<(Uuid, Uuid)>,
    Query(query): Query<GetCommentsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let _post = sqlx::query_as::<_, CommunityPost>(
        "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cp.title, cp.content, cp.pinned, cp.locked,
                (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
         FROM community_posts cp
         JOIN users u ON u.id = cp.author_id
         WHERE cp.id = $1 AND cp.community_id = $2",
    )
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "post not found" })),
        )
    })?;

    let limit = query.limit.unwrap_or(50).min(100);

    let comments = if let Some(before) = query.before {
        sqlx::query_as::<_, CommunityComment>(
            "SELECT cc.id, cc.post_id, cc.author_id,
                    u.username AS author_username, u.avatar_url AS author_avatar_url,
                    cc.content, cc.deleted_for_everyone, cc.deleted_at, cc.created_at, cc.updated_at
             FROM community_comments cc
             JOIN users u ON u.id = cc.author_id
             WHERE cc.post_id = $1 AND cc.created_at < $2
             ORDER BY cc.created_at ASC
             LIMIT $3",
        )
        .bind(post_id)
        .bind(before)
        .bind(limit)
        .fetch_all(&pool)
        .await
    } else {
        sqlx::query_as::<_, CommunityComment>(
            "SELECT cc.id, cc.post_id, cc.author_id,
                    u.username AS author_username, u.avatar_url AS author_avatar_url,
                    cc.content, cc.deleted_for_everyone, cc.deleted_at, cc.created_at, cc.updated_at
             FROM community_comments cc
             JOIN users u ON u.id = cc.author_id
             WHERE cc.post_id = $1
             ORDER BY cc.created_at ASC
             LIMIT $2",
        )
        .bind(post_id)
        .bind(limit)
        .fetch_all(&pool)
        .await
    }
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch comments" })),
        )
    })?;

    Ok(Json(json!({ "comments": comments })))
}

pub async fn create_comment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<CreateCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.muted {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are muted in this community" })),
        ));
    }

    if body.content.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "comment content is required" })),
        ));
    }

    // Check post exists, belongs to community, and is not locked
    let post = sqlx::query_as::<_, CommunityPost>(
        "SELECT cp.id, cp.community_id, cp.channel_id, cp.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cp.title, cp.content, cp.pinned, cp.locked,
                (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id) AS comment_count,
                cp.deleted_for_everyone, cp.deleted_at, cp.created_at, cp.updated_at
         FROM community_posts cp
         JOIN users u ON u.id = cp.author_id
         WHERE cp.id = $1 AND cp.community_id = $2",
    )
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "post not found" })),
        )
    })?;

    if post.locked {
        let is_admin = member.role == "OWNER" || member.role == "ADMIN";
        if !is_admin {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "this post is locked" })),
            ));
        }
    }

    let comment = sqlx::query_as::<_, CommunityComment>(
        "INSERT INTO community_comments (post_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, post_id, author_id,
                   (SELECT username FROM users WHERE id = $2) AS author_username,
                   (SELECT avatar_url FROM users WHERE id = $2) AS author_avatar_url,
                   content, deleted_for_everyone, deleted_at, created_at, updated_at",
    )
    .bind(post_id)
    .bind(auth.0)
    .bind(body.content.trim())
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create comment" })),
        )
    })?;

    Ok(Json(json!({ "comment": comment })))
}

pub async fn update_comment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id, comment_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(body): Json<UpdateCommentRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let comment = sqlx::query_as::<_, CommunityComment>(
        "SELECT cc.id, cc.post_id, cc.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cc.content, cc.deleted_for_everyone, cc.deleted_at, cc.created_at, cc.updated_at
         FROM community_comments cc
         JOIN users u ON u.id = cc.author_id
         JOIN community_posts cp ON cp.id = cc.post_id
         WHERE cc.id = $1 AND cc.post_id = $2 AND cp.community_id = $3",
    )
    .bind(comment_id)
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "comment not found" })),
        )
    })?;

    if comment.author_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the author can edit this comment" })),
        ));
    }

    if body.content.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "comment content is required" })),
        ));
    }

    let updated = sqlx::query_as::<_, CommunityComment>(
        "UPDATE community_comments SET content = $1, updated_at = NOW()
         WHERE id = $2 AND post_id = $3
         RETURNING id, post_id, author_id,
                   (SELECT username FROM users WHERE author_id = $3) AS author_username,
                   (SELECT avatar_url FROM users WHERE author_id = $3) AS author_avatar_url,
                   content, deleted_for_everyone, deleted_at, created_at, updated_at",
    )
    .bind(body.content.trim())
    .bind(comment_id)
    .bind(post_id)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to update comment" })),
        )
    })?;

    Ok(Json(json!({ "comment": updated })))
}

pub async fn delete_comment(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, post_id, comment_id)): Path<(Uuid, Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let comment = sqlx::query_as::<_, CommunityComment>(
        "SELECT cc.id, cc.post_id, cc.author_id,
                u.username AS author_username, u.avatar_url AS author_avatar_url,
                cc.content, cc.deleted_for_everyone, cc.deleted_at, cc.created_at, cc.updated_at
         FROM community_comments cc
         JOIN users u ON u.id = cc.author_id
         JOIN community_posts cp ON cp.id = cc.post_id
         WHERE cc.id = $1 AND cc.post_id = $2 AND cp.community_id = $3",
    )
    .bind(comment_id)
    .bind(post_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "comment not found" })),
        )
    })?;

    let is_author = comment.author_id == auth.0;
    if !is_author {
        let member = sqlx::query_as::<_, CommunityMember>(
            "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
        )
        .bind(id)
        .bind(auth.0)
        .fetch_optional(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "database error" })),
            )
        })?
        .ok_or_else(|| {
            (
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "you are not a member of this community" })),
            )
        })?;

        if member.role != "OWNER" && member.role != "ADMIN" {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "only the author, owner, or admin can delete this comment" })),
            ));
        }
    }

    sqlx::query("DELETE FROM community_comments WHERE id = $1 AND post_id = $2")
        .bind(comment_id)
        .bind(post_id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to delete comment" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "comment_id": comment_id })))
}

pub async fn list_events(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(query): Query<GetEventsQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let limit = query.limit.unwrap_or(30).min(100);
    let now = chrono::Utc::now();

    let after = query.after.unwrap_or(now);
    let before = query.before;

    let events = if let Some(before) = before {
        sqlx::query_as::<_, CommunityEvent>(
            "SELECT ce.id, ce.community_id, ce.creator_id,
                    u.username AS creator_username,
                    ce.title, ce.description, ce.location,
                    ce.start_time, ce.end_time, ce.all_day, ce.recurrence, ce.max_attendees,
                    (SELECT COUNT(*) FROM community_event_rsvps cr WHERE cr.event_id = ce.id) AS attendee_count,
                    ce.created_at, ce.updated_at
             FROM community_events ce
             JOIN users u ON u.id = ce.creator_id
             WHERE ce.community_id = $1 AND ce.start_time >= $2 AND ce.start_time < $3
             ORDER BY ce.start_time ASC
             LIMIT $4",
        )
        .bind(id)
        .bind(after)
        .bind(before)
        .bind(limit)
        .fetch_all(&pool)
        .await
    } else {
        sqlx::query_as::<_, CommunityEvent>(
            "SELECT ce.id, ce.community_id, ce.creator_id,
                    u.username AS creator_username,
                    ce.title, ce.description, ce.location,
                    ce.start_time, ce.end_time, ce.all_day, ce.recurrence, ce.max_attendees,
                    (SELECT COUNT(*) FROM community_event_rsvps cr WHERE cr.event_id = ce.id) AS attendee_count,
                    ce.created_at, ce.updated_at
             FROM community_events ce
             JOIN users u ON u.id = ce.creator_id
             WHERE ce.community_id = $1 AND ce.start_time >= $2
             ORDER BY ce.start_time ASC
             LIMIT $3",
        )
        .bind(id)
        .bind(after)
        .bind(limit)
        .fetch_all(&pool)
        .await
    }
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch events" })),
        )
    })?;

    Ok(Json(json!({ "events": events })))
}

pub async fn create_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateEventRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.role != "OWNER" && member.role != "ADMIN" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner or admin can create events" })),
        ));
    }

    if body.title.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "event title is required" })),
        ));
    }

    let event = sqlx::query_as::<_, CommunityEvent>(
        "INSERT INTO community_events (community_id, creator_id, title, description, location, start_time, end_time, all_day, recurrence, max_attendees)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, community_id, creator_id,
                   (SELECT username FROM users WHERE id = $2) AS creator_username,
                   title, description, location, start_time, end_time, all_day, recurrence, max_attendees,
                   0 AS attendee_count, created_at, updated_at",
    )
    .bind(id)
    .bind(auth.0)
    .bind(body.title.trim())
    .bind(&body.description)
    .bind(&body.location)
    .bind(body.start_time)
    .bind(body.end_time)
    .bind(body.all_day.unwrap_or(false))
    .bind(&body.recurrence)
    .bind(body.max_attendees)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create event" })),
        )
    })?;

    Ok(Json(json!({ "event": event })))
}

pub async fn get_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, event_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let event = sqlx::query_as::<_, CommunityEvent>(
        "SELECT ce.id, ce.community_id, ce.creator_id,
                u.username AS creator_username,
                ce.title, ce.description, ce.location,
                ce.start_time, ce.end_time, ce.all_day, ce.recurrence, ce.max_attendees,
                (SELECT COUNT(*) FROM community_event_rsvps cr WHERE cr.event_id = ce.id) AS attendee_count,
                ce.created_at, ce.updated_at
         FROM community_events ce
         JOIN users u ON u.id = ce.creator_id
         WHERE ce.id = $1 AND ce.community_id = $2",
    )
    .bind(event_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "event not found" })),
        )
    })?;

    Ok(Json(json!({ "event": event })))
}

pub async fn update_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, event_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateEventRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    let is_creator = sqlx::query_as::<_, (Uuid,)>(
        "SELECT creator_id FROM community_events WHERE id = $1 AND community_id = $2",
    )
    .bind(event_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "event not found" })),
        )
    })?;

    let is_admin = member.role == "OWNER" || member.role == "ADMIN";
    if !is_admin && is_creator.0 != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner, admin, or event creator can update" })),
        ));
    }

    let mut updates = Vec::new();
    let mut param_count = 1;

    if body.title.is_some() {
        updates.push(format!("title = ${}", param_count));
        param_count += 1;
    }
    if body.description.is_some() {
        updates.push(format!("description = ${}", param_count));
        param_count += 1;
    }
    if body.location.is_some() {
        updates.push(format!("location = ${}", param_count));
        param_count += 1;
    }
    if body.start_time.is_some() {
        updates.push(format!("start_time = ${}", param_count));
        param_count += 1;
    }
    if body.end_time.is_some() {
        updates.push(format!("end_time = ${}", param_count));
        param_count += 1;
    }
    if body.all_day.is_some() {
        updates.push(format!("all_day = ${}", param_count));
        param_count += 1;
    }
    if body.recurrence.is_some() {
        updates.push(format!("recurrence = ${}", param_count));
        param_count += 1;
    }
    if body.max_attendees.is_some() {
        updates.push(format!("max_attendees = ${}", param_count));
        param_count += 1;
    }

    if updates.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "no fields to update" })),
        ));
    }

    updates.push("updated_at = NOW()".to_string());

    let query = format!(
        "UPDATE community_events SET {} WHERE id = ${} AND community_id = ${} RETURNING *",
        updates.join(", "),
        param_count,
        param_count + 1
    );

    let mut sqlx_query = sqlx::query_as::<_, CommunityEvent>(&query);

    if let Some(title) = body.title {
        sqlx_query = sqlx_query.bind(title);
    }
    if let Some(description) = body.description {
        sqlx_query = sqlx_query.bind(description);
    }
    if let Some(location) = body.location {
        sqlx_query = sqlx_query.bind(location);
    }
    if let Some(start_time) = body.start_time {
        sqlx_query = sqlx_query.bind(start_time);
    }
    if let Some(end_time) = body.end_time {
        sqlx_query = sqlx_query.bind(end_time);
    }
    if let Some(all_day) = body.all_day {
        sqlx_query = sqlx_query.bind(all_day);
    }
    if let Some(recurrence) = body.recurrence {
        sqlx_query = sqlx_query.bind(recurrence);
    }
    if let Some(max_attendees) = body.max_attendees {
        sqlx_query = sqlx_query.bind(max_attendees);
    }

    sqlx_query = sqlx_query.bind(event_id).bind(id);

    let updated = sqlx_query
        .fetch_one(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to update event" })),
            )
        })?;

    Ok(Json(json!({ "event": updated })))
}

pub async fn delete_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, event_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    let is_creator = sqlx::query_as::<_, (Uuid,)>(
        "SELECT creator_id FROM community_events WHERE id = $1 AND community_id = $2",
    )
    .bind(event_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "event not found" })),
        )
    })?;

    let is_admin = member.role == "OWNER" || member.role == "ADMIN";
    if !is_admin && is_creator.0 != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only owner, admin, or event creator can delete" })),
        ));
    }

    sqlx::query("DELETE FROM community_events WHERE id = $1 AND community_id = $2")
        .bind(event_id)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to delete event" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "event_id": event_id })))
}

pub async fn rsvp_event(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, event_id)): Path<(Uuid, Uuid)>,
    Json(body): Json<RsvpEventRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    let valid_statuses = ["GOING", "MAYBE", "NOT_GOING"];
    if !valid_statuses.contains(&body.status.as_str()) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid status. Valid: GOING, MAYBE, NOT_GOING" })),
        ));
    }

    // Check event exists
    let _event = sqlx::query_as::<_, CommunityEvent>(
        "SELECT ce.id, ce.community_id, ce.creator_id,
                u.username AS creator_username,
                ce.title, ce.description, ce.location,
                ce.start_time, ce.end_time, ce.all_day, ce.recurrence, ce.max_attendees,
                (SELECT COUNT(*) FROM community_event_rsvps cr WHERE cr.event_id = ce.id) AS attendee_count,
                ce.created_at, ce.updated_at
         FROM community_events ce
         JOIN users u ON u.id = ce.creator_id
         WHERE ce.id = $1 AND ce.community_id = $2",
    )
    .bind(event_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "event not found" })),
        )
    })?;

    // Check max attendees if GOING
    if body.status == "GOING" {
        let max_check: Option<(Option<i32>, i64)> = sqlx::query_as(
            "SELECT ce.max_attendees,
                    (SELECT COUNT(*) FROM community_event_rsvps cr WHERE cr.event_id = ce.id AND cr.status = 'GOING') AS going_count
             FROM community_events ce WHERE ce.id = $1",
        )
        .bind(event_id)
        .fetch_optional(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "database error" })),
            )
        })?;

        if let Some((Some(max), going)) = max_check {
            // Check if already going
            let already_going = sqlx::query_as::<_, (Uuid,)>(
                "SELECT user_id FROM community_event_rsvps WHERE event_id = $1 AND user_id = $2 AND status = 'GOING'",
            )
            .bind(event_id)
            .bind(auth.0)
            .fetch_optional(&pool)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "database error" })),
                )
            })?;

            if already_going.is_none() && going >= max as i64 {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "event is at full capacity" })),
                ));
            }
        }
    }

    sqlx::query(
        "INSERT INTO community_event_rsvps (event_id, user_id, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id) DO UPDATE SET status = $3",
    )
    .bind(event_id)
    .bind(auth.0)
    .bind(&body.status)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to RSVP" })),
        )
    })?;

    Ok(Json(json!({ "status": "ok", "rsvp": body.status })))
}

pub async fn list_invites(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let is_member = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if is_member.is_none() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        ));
    }

    let invites = sqlx::query_as::<_, CommunityInvite>(
        "SELECT ci.id, ci.community_id, ci.inviter_id,
                ui.username AS inviter_username,
                ci.invitee_id,
                ue.username AS invitee_username,
                ci.code, ci.status, ci.created_at, ci.expires_at
         FROM community_invites ci
         JOIN users ui ON ui.id = ci.inviter_id
         LEFT JOIN users ue ON ue.id = ci.invitee_id
         WHERE ci.community_id = $1
         ORDER BY ci.created_at DESC",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to fetch invites" })),
        )
    })?;

    Ok(Json(json!({ "invites": invites })))
}

fn generate_invite_code() -> String {
    use std::fmt::Write;
    let bytes: [u8; 8] = rand::random();
    let mut code = String::with_capacity(12);
    for b in bytes {
        let _ = write!(code, "{:02x}", b);
    }
    code
}

pub async fn create_invite(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CreateInviteRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.role != "OWNER" && member.role != "ADMIN" && member.role != "MODERATOR" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you don't have permission to create invites" })),
        ));
    }

    let code = generate_invite_code();
    let expires_in_days = body.expires_in_days.unwrap_or(7);
    let expires_at = chrono::Utc::now() + chrono::Duration::days(expires_in_days as i64);

    let invite = sqlx::query_as::<_, CommunityInvite>(
        "INSERT INTO community_invites (community_id, inviter_id, invitee_id, code, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, community_id, inviter_id,
                   (SELECT username FROM users WHERE id = $2) AS inviter_username,
                   invitee_id,
                   (SELECT username FROM users WHERE id = $3) AS invitee_username,
                   code, status, created_at, expires_at",
    )
    .bind(id)
    .bind(auth.0)
    .bind(body.invitee_id)
    .bind(&code)
    .bind(expires_at)
    .fetch_one(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to create invite" })),
        )
    })?;

    Ok(Json(json!({ "invite": invite })))
}

pub async fn revoke_invite(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, invite_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    let invite = sqlx::query_as::<_, CommunityInvite>(
        "SELECT ci.id, ci.community_id, ci.inviter_id,
                ui.username AS inviter_username,
                ci.invitee_id,
                ue.username AS invitee_username,
                ci.code, ci.status, ci.created_at, ci.expires_at
         FROM community_invites ci
         JOIN users ui ON ui.id = ci.inviter_id
         LEFT JOIN users ue ON ue.id = ci.invitee_id
         WHERE ci.id = $1 AND ci.community_id = $2",
    )
    .bind(invite_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "invite not found" })),
        )
    })?;

    let is_owner_or_admin = member.role == "OWNER" || member.role == "ADMIN";
    if !is_owner_or_admin && invite.inviter_id != auth.0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "only the inviter, owner, or admin can revoke" })),
        ));
    }

    sqlx::query("DELETE FROM community_invites WHERE id = $1")
        .bind(invite_id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to revoke invite" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "invite_id": invite_id })))
}

pub async fn accept_invite(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, invite_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let invite = sqlx::query_as::<_, CommunityInvite>(
        "SELECT ci.id, ci.community_id, ci.inviter_id,
                ui.username AS inviter_username,
                ci.invitee_id,
                ue.username AS invitee_username,
                ci.code, ci.status, ci.created_at, ci.expires_at
         FROM community_invites ci
         JOIN users ui ON ui.id = ci.inviter_id
         LEFT JOIN users ue ON ue.id = ci.invitee_id
         WHERE ci.id = $1 AND ci.community_id = $2",
    )
    .bind(invite_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "invite not found" })),
        )
    })?;

    if invite.status != "PENDING" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invite is no longer pending" })),
        ));
    }

    if let Some(expires) = invite.expires_at {
        if chrono::Utc::now() > expires {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invite has expired" })),
            ));
        }
    }

    // If invite is targeted to a specific user, only they can accept
    if let Some(target_id) = invite.invitee_id {
        if target_id != auth.0 {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "this invite is not for you" })),
            ));
        }
    }

    // Check not already a member
    let existing = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if existing.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "you are already a member" })),
        ));
    }

    // Add as member
    sqlx::query(
        "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'MEMBER')",
    )
    .bind(id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to join community" })),
        )
    })?;

    // Update member count
    sqlx::query("UPDATE communities SET member_count = member_count + 1 WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .ok();

    // Update invite status
    sqlx::query("UPDATE community_invites SET status = 'ACCEPTED' WHERE id = $1")
        .bind(invite_id)
        .execute(&pool)
        .await
        .ok();

    Ok(Json(json!({ "status": "ok", "message": "joined community via invite" })))
}

pub async fn reject_invite(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path((id, invite_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let invite = sqlx::query_as::<_, CommunityInvite>(
        "SELECT ci.id, ci.community_id, ci.inviter_id,
                ui.username AS inviter_username,
                ci.invitee_id,
                ue.username AS invitee_username,
                ci.code, ci.status, ci.created_at, ci.expires_at
         FROM community_invites ci
         JOIN users ui ON ui.id = ci.inviter_id
         LEFT JOIN users ue ON ue.id = ci.invitee_id
         WHERE ci.id = $1 AND ci.community_id = $2",
    )
    .bind(invite_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "invite not found" })),
        )
    })?;

    if invite.status != "PENDING" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invite is no longer pending" })),
        ));
    }

    if let Some(target_id) = invite.invitee_id {
        if target_id != auth.0 {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "this invite is not for you" })),
            ));
        }
    }

    sqlx::query("UPDATE community_invites SET status = 'REJECTED' WHERE id = $1")
        .bind(invite_id)
        .execute(&pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to reject invite" })),
            )
        })?;

    Ok(Json(json!({ "status": "ok", "message": "invite rejected" })))
}

pub async fn join_by_code(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Json(body): Json<JoinByCodeRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let invite = sqlx::query_as::<_, CommunityInvite>(
        "SELECT ci.id, ci.community_id, ci.inviter_id,
                ui.username AS inviter_username,
                ci.invitee_id,
                ue.username AS invitee_username,
                ci.code, ci.status, ci.created_at, ci.expires_at
         FROM community_invites ci
         JOIN users ui ON ui.id = ci.inviter_id
         LEFT JOIN users ue ON ue.id = ci.invitee_id
         WHERE ci.code = $1",
    )
    .bind(&body.code)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "invalid invite code" })),
        )
    })?;

    if invite.status != "PENDING" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invite is no longer valid" })),
        ));
    }

    if let Some(expires) = invite.expires_at {
        if chrono::Utc::now() > expires {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invite has expired" })),
            ));
        }
    }

    if let Some(target_id) = invite.invitee_id {
        if target_id != auth.0 {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "this invite is not for you" })),
            ));
        }
    }

    let existing = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM community_members WHERE community_id = $1 AND user_id = $2",
    )
    .bind(invite.community_id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?;

    if existing.is_some() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "you are already a member" })),
        ));
    }

    sqlx::query(
        "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'MEMBER')",
    )
    .bind(invite.community_id)
    .bind(auth.0)
    .execute(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to join community" })),
        )
    })?;

    sqlx::query("UPDATE communities SET member_count = member_count + 1 WHERE id = $1")
        .bind(invite.community_id)
        .execute(&pool)
        .await
        .ok();

    sqlx::query("UPDATE community_invites SET status = 'ACCEPTED' WHERE id = $1")
        .bind(invite.id)
        .execute(&pool)
        .await
        .ok();

    Ok(Json(json!({ "status": "ok", "community_id": invite.community_id })))
}

pub async fn upload_community_file(
    State(pool): State<PgPool>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let member = sqlx::query_as::<_, CommunityMember>(
        "SELECT cm.*, u.username, u.avatar_url, u.name FROM community_members cm JOIN users u ON u.id = cm.user_id WHERE cm.community_id = $1 AND cm.user_id = $2",
    )
    .bind(id)
    .bind(auth.0)
    .fetch_optional(&pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "database error" })),
        )
    })?
    .ok_or_else(|| {
        (
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are not a member of this community" })),
        )
    })?;

    if member.muted {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "you are muted in this community" })),
        ));
    }

    let upload_dir = std::path::Path::new("uploads");

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid multipart data" })),
            )
        })? {
        let file_name = field
            .file_name()
            .unwrap_or("file")
            .to_string();

        let ext = file_name
            .rsplit('.')
            .next()
            .unwrap_or("bin")
            .to_lowercase();

        let (subfolder, max_size) = match ext.as_str() {
            "jpg" | "jpeg" | "png" | "gif" | "webp" => ("images", 20 * 1024 * 1024),
            "mp4" | "mov" | "webm" | "mkv" | "avi" => ("videos", 250 * 1024 * 1024),
            "mp3" | "wav" | "caf" | "ogg" | "aac" | "m4a" | "opus" => ("audio", 50 * 1024 * 1024),
            _ => ("documents", 500 * 1024 * 1024),
        };

        let target_dir = upload_dir.join(subfolder);
        tokio::fs::create_dir_all(&target_dir)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "failed to create upload directory" })),
                )
            })?;

        let id_str = uuid::Uuid::new_v4().to_string();
        let stored_name = format!("{}.{}", id_str, ext);
        let file_path = target_dir.join(&stored_name);

        let mut file = tokio::fs::File::create(&file_path)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "failed to create file" })),
                )
            })?;

        let mut size: i64 = 0;
        while let Some(chunk) = field
            .chunk()
            .await
            .map_err(|_| {
                (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "failed to read chunk" })),
                )
            })? {
            size += chunk.len() as i64;
            if size > max_size {
                let _ = tokio::fs::remove_file(&file_path).await;
                return Err((
                    StatusCode::PAYLOAD_TOO_LARGE,
                    Json(json!({ "error": "file too large" })),
                ));
            }
            tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
                .await
                .map_err(|_| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "failed to write file" })),
                    )
                })?;
        }

        let url = format!("/uploads/{}/{}", subfolder, stored_name);

        return Ok(Json(json!({
            "url": url,
            "filename": file_name,
            "size": size
        })));
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "no file provided" })),
    ))
}
