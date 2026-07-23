export type CommunityVisibility = "public" | "private";

export type ChannelType = "text" | "forum" | "event";

export type MemberRole = "owner" | "admin" | "member";

export type EventRsvpStatus = "going" | "interested" | "not_going";

export interface Community {
  id: string;
  name: string;
  description?: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  owner_id: string;
  visibility: CommunityVisibility;
  category?: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: MemberRole;
  nickname?: string | null;
  muted: boolean;
  joined_at: string;
  username?: string | null;
  avatar_url?: string | null;
  name?: string | null;
  online?: boolean;
}

export interface CommunityChannel {
  id: string;
  community_id: string;
  type: ChannelType;
  name: string;
  description?: string | null;
  position: number;
  created_at: string;
}

export interface CommunityMessage {
  id: string;
  channel_id: string;
  community_id: string;
  sender_id: string;
  sender_username?: string | null;
  sender_avatar_url?: string | null;
  content?: string | null;
  image_url?: string | null;
  msg_type: string;
  deleted_for_everyone: boolean;
  deleted_at?: string | null;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  community_id: string;
  channel_id?: string | null;
  author_id: string;
  author_username?: string | null;
  author_avatar_url?: string | null;
  title: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  comment_count: number;
  deleted_for_everyone: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  author_username?: string | null;
  author_avatar_url?: string | null;
  content: string;
  deleted_for_everyone: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityEvent {
  id: string;
  community_id: string;
  creator_id: string;
  creator_username?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: string;
  end_time?: string | null;
  all_day: boolean;
  recurrence?: string | null;
  max_attendees?: number | null;
  attendee_count: number;
  user_rsvp?: EventRsvpStatus;
  created_at: string;
  updated_at: string;
}

export interface CommunityInvite {
  id: string;
  community_id: string;
  inviter_id: string;
  inviter_username?: string | null;
  invitee_id?: string | null;
  invitee_username?: string | null;
  code: string;
  status: string;
  created_at: string;
  expires_at?: string | null;
}

export interface CreateCommunityPayload {
  name: string;
  description?: string;
  icon_url?: string;
  banner_url?: string;
  visibility?: CommunityVisibility;
  category?: string;
}

export interface CreateChannelPayload {
  name: string;
  type?: ChannelType;
  description?: string;
  position?: number;
}

export interface CreatePostPayload {
  title: string;
  content: string;
  channel_id?: string;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  recurrence?: string;
  max_attendees?: number;
}
