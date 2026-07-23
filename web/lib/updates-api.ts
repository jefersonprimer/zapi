import { authFetch, API_URL } from "./api";

export interface Publisher {
  id: string;
  type: "user" | "channel" | "business";
  ref_id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  is_following?: boolean;
  followers_count?: number;
  following_count?: number;
}

export interface StoryAttachment {
  id: string;
  url: string;
  type: "image" | "video" | "gif";
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

export interface Story {
  id: string;
  publisher_id: string;
  publisher_name: string;
  publisher_avatar: string | null;
  publisher_type: string;
  is_verified: boolean;
  content: string | null;
  background_color: string | null;
  font_color: string | null;
  created_at: string;
  expires_at: string;
  viewed: boolean;
  attachments: StoryAttachment[];
}

export interface StoryGroup {
  publisher_id: string;
  publisher_name: string;
  publisher_avatar: string | null;
  publisher_type: string;
  is_verified: boolean;
  stories: Story[];
  all_viewed: boolean;
}

export interface PostAttachment {
  id: string;
  type: string;
  url: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnail_url: string | null;
  sort_order: number;
}

export interface PollOption {
  id: string;
  label: string;
  votes_count: number;
  percentage: number;
}

export interface FeedPost {
  id: string;
  publisher_id: string;
  publisher_name: string;
  publisher_avatar: string | null;
  publisher_type: string;
  is_verified: boolean;
  type: string;
  content: string | null;
  visibility: string;
  is_pinned: boolean;
  attachments: PostAttachment[];
  poll_options: PollOption[] | null;
  poll_expires_at: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  liked_by_me: boolean;
  saved_by_me: boolean;
  voted_option: string | null;
}

export interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  parent_id: string | null;
  content: string;
  likes_count: number;
  liked_by_me: boolean;
  created_at: string;
  replies: Comment[];
}

export async function getMyPublisher(token: string): Promise<Publisher> {
  return authFetch(`${API_URL}/updates/publishers/me`, token);
}

export async function getPublisher(
  token: string,
  id: string
): Promise<Publisher> {
  return authFetch(`${API_URL}/updates/publishers/${id}`, token);
}

export async function getPublisherPosts(
  token: string,
  publisherId: string,
  page: number = 1,
  limit: number = 12
): Promise<FeedPost[]> {
  return authFetch(
    `${API_URL}/updates/publishers/${publisherId}/posts?page=${page}&limit=${limit}`,
    token
  );
}

export async function getPublisherByUser(
  token: string,
  userId: string
): Promise<Publisher> {
  return authFetch(`${API_URL}/updates/publishers/by-user/${userId}`, token);
}

export async function getPublisherByUsername(
  token: string,
  username: string
): Promise<Publisher> {
  const cleanUsername = username.replace(/^@/, "");
  return authFetch(
    `${API_URL}/updates/publishers/by-username/${cleanUsername}`,
    token
  );
}

export async function getStories(token: string): Promise<StoryGroup[]> {
  return authFetch(`${API_URL}/updates/stories`, token);
}

export async function createStory(
  token: string,
  data: {
    content?: string | null;
    background_color?: string | null;
    font_color?: string | null;
    attachments: {
      url: string;
      type: string;
      mime_type?: string;
      width?: number;
      height?: number;
      duration?: number;
      size?: number;
    }[];
  }
): Promise<Story> {
  return authFetch(`${API_URL}/updates/stories`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteStory(
  token: string,
  storyId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/stories/${storyId}`, token, {
    method: "DELETE",
  });
}

export async function markStoryViewed(
  token: string,
  storyId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/stories/${storyId}/view`, token, {
    method: "POST",
  });
}

export async function getPublisherStories(
  token: string,
  publisherId: string
): Promise<Story[]> {
  return authFetch(
    `${API_URL}/updates/stories/publisher/${publisherId}`,
    token
  );
}

export async function getFeed(
  token: string,
  page: number = 1,
  limit: number = 20
): Promise<FeedPost[]> {
  return authFetch(
    `${API_URL}/updates/posts?page=${page}&limit=${limit}`,
    token
  );
}

export interface CreatePostPayload {
  type: string;
  content?: string | null;
  visibility?: string;
  attachments?: {
    url: string;
    type: string;
    mime_type?: string;
    width?: number;
    height?: number;
    duration?: number;
    size?: number;
    sha256?: string;
    thumbnail_url?: string;
  }[];
  poll_options?: string[];
  poll_duration_hours?: number;
}

export async function createPost(
  token: string,
  data: CreatePostPayload
): Promise<FeedPost> {
  return authFetch(`${API_URL}/updates/posts`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPost(
  token: string,
  postId: string
): Promise<FeedPost> {
  return authFetch(`${API_URL}/updates/posts/${postId}`, token);
}

export async function deletePost(
  token: string,
  postId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/posts/${postId}`, token, {
    method: "DELETE",
  });
}

export async function toggleLike(
  token: string,
  postId: string
): Promise<{ liked: boolean }> {
  return authFetch(`${API_URL}/updates/posts/${postId}/like`, token, {
    method: "POST",
  });
}

export async function getComments(
  token: string,
  postId: string,
  page: number = 1
): Promise<Comment[]> {
  return authFetch(
    `${API_URL}/updates/posts/${postId}/comment?page=${page}`,
    token
  );
}

export async function addComment(
  token: string,
  postId: string,
  data: { content: string; parent_id?: string | null }
): Promise<Comment> {
  return authFetch(`${API_URL}/updates/posts/${postId}/comment`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteComment(
  token: string,
  postId: string,
  commentId: string
): Promise<{ status: string }> {
  return authFetch(
    `${API_URL}/updates/posts/${postId}/comment/${commentId}`,
    token,
    { method: "DELETE" }
  );
}

export async function toggleCommentLike(
  token: string,
  postId: string,
  commentId: string
): Promise<{ liked: boolean }> {
  return authFetch(
    `${API_URL}/updates/posts/${postId}/comment/${commentId}/like`,
    token,
    { method: "POST" }
  );
}

export async function sharePost(
  token: string,
  postId: string,
  data: { share_target: string; target_id?: string | null }
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/posts/${postId}/share`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function votePoll(
  token: string,
  postId: string,
  data: { option_id: string }
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/posts/${postId}/vote`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function toggleSave(
  token: string,
  postId: string
): Promise<{ saved: boolean }> {
  return authFetch(`${API_URL}/updates/posts/${postId}/save`, token, {
    method: "POST",
  });
}

export async function hidePost(
  token: string,
  postId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/posts/${postId}/hide`, token, {
    method: "POST",
  });
}

export async function getSavedPosts(
  token: string,
  page: number = 1
): Promise<FeedPost[]> {
  return authFetch(`${API_URL}/updates/saved?page=${page}`, token);
}

export async function toggleFollow(
  token: string,
  publisherId: string
): Promise<{ following: boolean }> {
  return authFetch(`${API_URL}/updates/follow/${publisherId}`, token, {
    method: "POST",
  });
}

export async function toggleFollowByUser(
  token: string,
  userId: string
): Promise<{ following: boolean }> {
  return authFetch(`${API_URL}/updates/follow/user/${userId}`, token, {
    method: "POST",
  });
}

export async function getFollowing(token: string): Promise<Publisher[]> {
  return authFetch(`${API_URL}/updates/following`, token);
}

export async function getFollowers(token: string): Promise<Publisher[]> {
  return authFetch(`${API_URL}/updates/followers`, token);
}

export async function toggleBlock(
  token: string,
  publisherId: string
): Promise<{ blocked: boolean }> {
  return authFetch(`${API_URL}/updates/blocks/${publisherId}`, token, {
    method: "POST",
  });
}

export async function toggleMute(
  token: string,
  publisherId: string
): Promise<{ muted: boolean }> {
  return authFetch(`${API_URL}/updates/mutes/${publisherId}`, token, {
    method: "POST",
  });
}

export async function createReport(
  token: string,
  data: {
    source_type: string;
    source_id: string;
    reason: string;
    description?: string | null;
  }
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/updates/reports`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
