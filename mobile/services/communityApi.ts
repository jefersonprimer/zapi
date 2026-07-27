import { API_URL, authFetch } from "./api";

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

export const communityApi = {
  async listCommunities(token: string): Promise<Community[]> {
    try {
      const data = await authFetch(`${API_URL}/communities`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend /communities call failed:", err);
    }
    return [];
  },

  async getCommunity(token: string, id: string): Promise<Community | null> {
    try {
      return await authFetch(`${API_URL}/communities/${id}`, token);
    } catch (err) {
      console.warn(`Backend /communities/${id} failed:`, err);
    }
    return null;
  },

  async createCommunity(token: string, payload: CreateCommunityPayload): Promise<Community> {
    return await authFetch(`${API_URL}/communities`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateCommunity(token: string, id: string, payload: Partial<CreateCommunityPayload>): Promise<Community> {
    return await authFetch(`${API_URL}/communities/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async deleteCommunity(token: string, id: string): Promise<boolean> {
    try {
      await authFetch(`${API_URL}/communities/${id}`, token, {
        method: "DELETE",
      });
      return true;
    } catch {
      return false;
    }
  },

  async joinCommunity(token: string, id: string): Promise<boolean> {
    try {
      await authFetch(`${API_URL}/communities/${id}/join`, token, {
        method: "POST",
      });
      return true;
    } catch (err) {
      console.warn("Backend join community failed:", err);
      return false;
    }
  },

  async joinByCode(token: string, code: string): Promise<Community | null> {
    try {
      return await authFetch(`${API_URL}/communities/join`, token, {
        method: "POST",
        body: JSON.stringify({ code }),
      });
    } catch (err) {
      console.warn("Backend join by code failed:", err);
      return null;
    }
  },

  async listChannels(token: string, communityId: string): Promise<CommunityChannel[]> {
    try {
      const data = await authFetch(`${API_URL}/communities/${communityId}/channels`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list channels failed:", err);
    }
    return [];
  },

  async createChannel(token: string, communityId: string, payload: CreateChannelPayload): Promise<CommunityChannel> {
    return await authFetch(`${API_URL}/communities/${communityId}/channels`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listMessages(token: string, communityId: string, channelId: string): Promise<CommunityMessage[]> {
    try {
      const data = await authFetch(`${API_URL}/communities/${communityId}/channels/${channelId}/messages`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list messages failed:", err);
    }
    return [];
  },

  async sendMessage(
    token: string,
    communityId: string,
    channelId: string,
    content: string,
    imageUrl?: string
  ): Promise<CommunityMessage> {
    return await authFetch(`${API_URL}/communities/${communityId}/channels/${channelId}/messages`, token, {
      method: "POST",
      body: JSON.stringify({ content, image_url: imageUrl }),
    });
  },

  async listPosts(token: string, communityId: string, channelId?: string): Promise<CommunityPost[]> {
    try {
      const url = channelId
        ? `${API_URL}/communities/${communityId}/posts?channel_id=${channelId}`
        : `${API_URL}/communities/${communityId}/posts`;
      const data = await authFetch(url, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list posts failed:", err);
    }
    return [];
  },

  async createPost(token: string, communityId: string, payload: CreatePostPayload): Promise<CommunityPost> {
    return await authFetch(`${API_URL}/communities/${communityId}/posts`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listComments(token: string, communityId: string, postId: string): Promise<CommunityComment[]> {
    try {
      const data = await authFetch(`${API_URL}/communities/${communityId}/posts/${postId}/comments`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list comments failed:", err);
    }
    return [];
  },

  async createComment(token: string, communityId: string, postId: string, content: string): Promise<CommunityComment> {
    return await authFetch(`${API_URL}/communities/${communityId}/posts/${postId}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  async listEvents(token: string, communityId: string): Promise<CommunityEvent[]> {
    try {
      const data = await authFetch(`${API_URL}/communities/${communityId}/events`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list events failed:", err);
    }
    return [];
  },

  async createEvent(token: string, communityId: string, payload: CreateEventPayload): Promise<CommunityEvent> {
    return await authFetch(`${API_URL}/communities/${communityId}/events`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async rsvpEvent(token: string, communityId: string, eventId: string, status: EventRsvpStatus): Promise<boolean> {
    try {
      await authFetch(`${API_URL}/communities/${communityId}/events/${eventId}/rsvp`, token, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      return true;
    } catch (err) {
      console.warn("Backend rsvp event failed:", err);
      return false;
    }
  },

  async listMembers(token: string, communityId: string): Promise<CommunityMember[]> {
    try {
      const data = await authFetch(`${API_URL}/communities/${communityId}/members`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list members failed:", err);
    }
    return [];
  },

  async listInvites(token: string, communityId: string): Promise<CommunityInvite[]> {
    try {
      const data = await authFetch(`${API_URL}/communities/${communityId}/invites`, token);
      if (Array.isArray(data)) return data;
    } catch (err) {
      console.warn("Backend list invites failed:", err);
    }
    return [];
  },

  async createInvite(token: string, communityId: string): Promise<CommunityInvite> {
    return await authFetch(`${API_URL}/communities/${communityId}/invites`, token, {
      method: "POST",
      body: JSON.stringify({ expires_in_days: 7 }),
    });
  },
};
