import { API_URL } from "./api";
import {
  Community,
  CommunityMember,
  CommunityChannel,
  CommunityMessage,
  CommunityPost,
  CommunityComment,
  CommunityEvent,
  CommunityInvite,
  CreateCommunityPayload,
  CreateChannelPayload,
  CreatePostPayload,
  CreateEventPayload,
  EventRsvpStatus,
} from "./community-types";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("token") || localStorage.getItem("zapi_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Memory stores for live updates during session
let memoryCommunities: Community[] = [];
const memoryChannels: Record<string, CommunityChannel[]> = {};
const memoryMessages: Record<string, CommunityMessage[]> = {};
const memoryPosts: Record<string, CommunityPost[]> = {};
const memoryComments: Record<string, CommunityComment[]> = {};
const memoryEvents: Record<string, CommunityEvent[]> = {};
const memoryMembers: Record<string, CommunityMember[]> = {};
const memoryInvites: Record<string, CommunityInvite[]> = {};

export const communityApi = {
  async listCommunities(): Promise<Community[]> {
    try {
      const res = await fetch(`${API_URL}/communities`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend /communities call failed:", err);
    }
    return memoryCommunities;
  },

  async getCommunity(id: string): Promise<Community | null> {
    try {
      const res = await fetch(`${API_URL}/communities/${id}`, {
        headers: getAuthHeader(),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn(`Backend /communities/${id} failed:`, err);
    }
    return memoryCommunities.find((c) => c.id === id) || null;
  },

  async createCommunity(payload: CreateCommunityPayload): Promise<Community> {
    try {
      const res = await fetch(`${API_URL}/communities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend create community failed, creating locally:", err);
    }
    const newComm: Community = {
      id: `comm-${Date.now()}`,
      name: payload.name,
      description: payload.description || "",
      icon_url: payload.icon_url || null,
      banner_url: payload.banner_url || null,
      owner_id: "user-current",
      visibility: payload.visibility || "public",
      category: payload.category || "Geral",
      member_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryCommunities = [newComm, ...memoryCommunities];
    memoryChannels[newComm.id] = [
      { id: `chan-${Date.now()}-1`, community_id: newComm.id, type: "text", name: "geral", description: "Canal geral", position: 1, created_at: new Date().toISOString() },
      { id: `chan-${Date.now()}-2`, community_id: newComm.id, type: "forum", name: "duvidas", description: "Fórum de perguntas", position: 2, created_at: new Date().toISOString() },
    ];
    return newComm;
  },

  async updateCommunity(id: string, payload: Partial<CreateCommunityPayload>): Promise<Community> {
    try {
      const res = await fetch(`${API_URL}/communities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend update community failed:", err);
    }
    memoryCommunities = memoryCommunities.map((c) =>
      c.id === id ? { ...c, ...payload, updated_at: new Date().toISOString() } : c
    );
    return memoryCommunities.find((c) => c.id === id)!;
  },

  async deleteCommunity(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/communities/${id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn("Backend delete community failed:", err);
    }
    memoryCommunities = memoryCommunities.filter((c) => c.id !== id);
    return true;
  },

  async joinCommunity(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/communities/${id}/join`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn("Backend join community failed:", err);
    }
    memoryCommunities = memoryCommunities.map((c) =>
      c.id === id ? { ...c, member_count: c.member_count + 1 } : c
    );
    return true;
  },

  async joinByCode(code: string): Promise<Community | null> {
    try {
      const res = await fetch(`${API_URL}/communities/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ code }),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend join by code failed:", err);
    }
    const foundInvite = Object.values(memoryInvites).flat().find((inv) => inv.code.toLowerCase() === code.trim().toLowerCase());
    if (foundInvite) {
      return this.getCommunity(foundInvite.community_id);
    }
    return null;
  },

  async listChannels(communityId: string): Promise<CommunityChannel[]> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/channels`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list channels failed:", err);
    }
    return memoryChannels[communityId] || [];
  },

  async createChannel(communityId: string, payload: CreateChannelPayload): Promise<CommunityChannel> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend create channel failed:", err);
    }
    const newChan: CommunityChannel = {
      id: `chan-${Date.now()}`,
      community_id: communityId,
      type: payload.type || "text",
      name: payload.name.toLowerCase().replace(/\s+/g, "-"),
      description: payload.description || "",
      position: (memoryChannels[communityId]?.length || 0) + 1,
      created_at: new Date().toISOString(),
    };
    if (!memoryChannels[communityId]) memoryChannels[communityId] = [];
    memoryChannels[communityId].push(newChan);
    return newChan;
  },

  async listMessages(communityId: string, channelId: string): Promise<CommunityMessage[]> {
    try {
      const res = await fetch(
        `${API_URL}/communities/${communityId}/channels/${channelId}/messages`,
        { headers: getAuthHeader() }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list messages failed:", err);
    }
    return memoryMessages[channelId] || [];
  },

  async sendMessage(
    communityId: string,
    channelId: string,
    content: string,
    imageUrl?: string
  ): Promise<CommunityMessage> {
    try {
      const res = await fetch(
        `${API_URL}/communities/${communityId}/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ content, image_url: imageUrl }),
        }
      );
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend send message failed:", err);
    }
    const newMsg: CommunityMessage = {
      id: `msg-${Date.now()}`,
      channel_id: channelId,
      community_id: communityId,
      sender_id: "user-me",
      sender_username: "Você",
      sender_avatar_url: null,
      content,
      image_url: imageUrl || null,
      msg_type: "text",
      deleted_for_everyone: false,
      created_at: new Date().toISOString(),
    };
    if (!memoryMessages[channelId]) memoryMessages[channelId] = [];
    memoryMessages[channelId].push(newMsg);
    return newMsg;
  },

  async listPosts(communityId: string, channelId?: string): Promise<CommunityPost[]> {
    try {
      const url = channelId
        ? `${API_URL}/communities/${communityId}/posts?channel_id=${channelId}`
        : `${API_URL}/communities/${communityId}/posts`;
      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list posts failed:", err);
    }
    const posts = memoryPosts[communityId] || [];
    return channelId ? posts.filter((p) => p.channel_id === channelId) : posts;
  },

  async createPost(communityId: string, payload: CreatePostPayload): Promise<CommunityPost> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend create post failed:", err);
    }
    const newPost: CommunityPost = {
      id: `post-${Date.now()}`,
      community_id: communityId,
      channel_id: payload.channel_id || null,
      author_id: "user-me",
      author_username: "Você",
      author_avatar_url: null,
      title: payload.title,
      content: payload.content,
      pinned: false,
      locked: false,
      comment_count: 0,
      deleted_for_everyone: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!memoryPosts[communityId]) memoryPosts[communityId] = [];
    memoryPosts[communityId].unshift(newPost);
    return newPost;
  },

  async listComments(communityId: string, postId: string): Promise<CommunityComment[]> {
    try {
      const res = await fetch(
        `${API_URL}/communities/${communityId}/posts/${postId}/comments`,
        { headers: getAuthHeader() }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list comments failed:", err);
    }
    return memoryComments[postId] || [];
  },

  async createComment(communityId: string, postId: string, content: string): Promise<CommunityComment> {
    try {
      const res = await fetch(
        `${API_URL}/communities/${communityId}/posts/${postId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ content }),
        }
      );
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend create comment failed:", err);
    }
    const newComment: CommunityComment = {
      id: `comment-${Date.now()}`,
      post_id: postId,
      author_id: "user-me",
      author_username: "Você",
      author_avatar_url: null,
      content,
      deleted_for_everyone: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!memoryComments[postId]) memoryComments[postId] = [];
    memoryComments[postId].push(newComment);
    return newComment;
  },

  async listEvents(communityId: string): Promise<CommunityEvent[]> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/events`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list events failed:", err);
    }
    return memoryEvents[communityId] || [];
  },

  async createEvent(communityId: string, payload: CreateEventPayload): Promise<CommunityEvent> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend create event failed:", err);
    }
    const newEvent: CommunityEvent = {
      id: `event-${Date.now()}`,
      community_id: communityId,
      creator_id: "user-me",
      creator_username: "Você",
      title: payload.title,
      description: payload.description || "",
      location: payload.location || "Zapi Voice Lounge",
      start_time: payload.start_time,
      end_time: payload.end_time || null,
      all_day: payload.all_day || false,
      max_attendees: payload.max_attendees || null,
      attendee_count: 1,
      user_rsvp: "going",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!memoryEvents[communityId]) memoryEvents[communityId] = [];
    memoryEvents[communityId].push(newEvent);
    return newEvent;
  },

  async rsvpEvent(communityId: string, eventId: string, status: EventRsvpStatus): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ status }),
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn("Backend rsvp event failed:", err);
    }
    const list = memoryEvents[communityId] || [];
    memoryEvents[communityId] = list.map((ev) => {
      if (ev.id === eventId) {
        const wasGoing = ev.user_rsvp === "going";
        const isGoing = status === "going";
        const diff = isGoing ? (wasGoing ? 0 : 1) : (wasGoing ? -1 : 0);
        return {
          ...ev,
          user_rsvp: status,
          attendee_count: Math.max(0, ev.attendee_count + diff),
        };
      }
      return ev;
    });
    return true;
  },

  async listMembers(communityId: string): Promise<CommunityMember[]> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/members`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list members failed:", err);
    }
    return memoryMembers[communityId] || [];
  },

  async listInvites(communityId: string): Promise<CommunityInvite[]> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/invites`, {
        headers: getAuthHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn("Backend list invites failed:", err);
    }
    return memoryInvites[communityId] || [];
  },

  async createInvite(communityId: string): Promise<CommunityInvite> {
    try {
      const res = await fetch(`${API_URL}/communities/${communityId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ expires_in_days: 7 }),
      });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend create invite failed:", err);
    }
    const newInv: CommunityInvite = {
      id: `inv-${Date.now()}`,
      community_id: communityId,
      inviter_id: "user-me",
      inviter_username: "Você",
      code: `ZAPI-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      status: "active",
      created_at: new Date().toISOString(),
    };
    if (!memoryInvites[communityId]) memoryInvites[communityId] = [];
    memoryInvites[communityId].push(newInv);
    return newInv;
  },
};

