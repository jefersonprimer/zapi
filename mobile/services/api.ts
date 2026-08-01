import { Platform } from "react-native";
import Constants from "expo-constants";

export const API_URL = (() => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === "web") {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `http://${hostname}:3000`;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:3000`;
  }
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
})();

export interface AuthResponse {
  token: string;
  user_id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  about?: string | null;
  name?: string | null;
}

export interface ChatListItem {
  id: string;
  participant_id: string | null;
  participant_username: string | null;
  participant_avatar_url: string | null;
  participant_name: string | null;
  participant_store_id?: string | null;
  is_group: boolean;
  name: string | null;
  avatar_url?: string | null;
  description?: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
  is_blocked_by_me?: boolean;
  is_blocked_by_them?: boolean;
  messages_restricted_reason?: "contacts" | "nobody" | null;
  cleared_at?: string | null;
  is_pinned?: boolean;
  notification_muted_until?: string | null;
  notification_muted_forever?: boolean;
  is_archived?: boolean;
  is_favorite?: boolean;
}

export interface Attachment {
  id: string;
  message_id: string;
  type: "image" | "video" | "audio" | "document";
  remote_url: string;
  local_path: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  size: number | null;
  sha256: string | null;
  thumbnail_path: string | null;
  download_status: "pending" | "downloading" | "downloaded" | "failed";
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_username: string;
  content: string | null;
  image_url: string | null;
  order_id?: string | null;
  local_file_path?: string | null; // Local cached file URI
  status?: "pending" | "uploading" | "uploaded" | "sending" | "sent" | "delivered" | "read" | "failed" | "privacy_messages_nobody" | "privacy_messages_contacts" | "chat_blocked"; // Delivery status
  created_at: string;
  deleted_for_everyone?: boolean;
  deleted_at?: string | null;
  attachments?: Attachment[];
  reaction?: string | null;
}

export async function authFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    throw new Error("Invalid JSON response from server");
  }

  if (!res.ok) {
    const code = typeof data.error === "string" ? data.error : undefined;
    const message =
      (typeof data.message === "string" && data.message) ||
      code ||
      "Request failed";
    const err = new Error(message) as Error & { code?: string };
    if (code) err.code = code;
    throw err;
  }
  return data;
}

export async function register(
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
  return data;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Login failed");
  return data;
}

export async function getChats(token: string, chatId?: string): Promise<{ chats: ChatListItem[] }> {
  const url = chatId ? `${API_URL}/chats?chat_id=${encodeURIComponent(chatId)}` : `${API_URL}/chats`;
  return authFetch(url, token);
}

export async function createChat(
  token: string,
  participantId: string
): Promise<{ id: string; already_exists: boolean }> {
  return authFetch(`${API_URL}/chats`, token, {
    method: "POST",
    body: JSON.stringify({ participant_id: participantId }),
  });
}

export async function getMessages(
  token: string,
  chatId: string,
  since?: string | null
): Promise<{ messages: Message[] }> {
  let url = `${API_URL}/chats/${chatId}/messages`;
  if (since) {
    url += `?since=${encodeURIComponent(since)}`;
  }
  return authFetch(url, token);
}

export interface UserSearchResult {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  about?: string | null;
  name?: string | null;
  store_id?: string | null;
}

export async function searchUsers(
  token: string,
  query: string
): Promise<{ users: UserSearchResult[] }> {
  return authFetch(
    `${API_URL}/users/search?q=${encodeURIComponent(query)}`,
    token
  );
}

export async function createGroup(
  token: string,
  name: string,
  participantIds: string[]
): Promise<{ id: string; name: string }> {
  return authFetch(`${API_URL}/groups`, token, {
    method: "POST",
    body: JSON.stringify({ name, participant_ids: participantIds }),
  });
}

export async function uploadFile(
  token: string,
  uri: string,
  name?: string,
  type?: string
): Promise<{ url: string }> {
  const formData = new FormData();
  if (Platform.OS === "web") {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append("file", blob, name || "file");
    } catch (err) {
      console.error("Failed to fetch blob from URI on web:", err);
      formData.append("file", {
        uri,
        type: type || "image/jpeg",
        name: name || "photo.jpg",
      } as any);
    }
  } else {
    formData.append("file", {
      uri,
      type: type || "image/jpeg",
      name: name || "photo.jpg",
    } as any);
  }

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);
    throw new Error("Invalid JSON response from upload server");
  }

  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data;
}

export async function uploadImage(
  token: string,
  uri: string
): Promise<{ url: string }> {
  return uploadFile(token, uri, "photo.jpg", "image/jpeg");
}

export async function checkFileHash(
  token: string,
  hash: string
): Promise<{ exists: boolean; url?: string }> {
  return authFetch(`${API_URL}/upload/check-hash?hash=${encodeURIComponent(hash)}`, token);
}

export async function sendMessage(
  token: string,
  chatId: string,
  content: string,
  imageUrl?: string,
  sha256?: string
): Promise<{ message: Message }> {
  return authFetch(`${API_URL}/chats/${chatId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ 
      content: content || null, 
      image_url: imageUrl || null,
      sha256: sha256 || null
    }),
  });
}

export interface Contact {
  contact_id: string;
  username: string;
  email: string;
  is_blocked: boolean;
  avatar_url?: string | null;
  about?: string | null;
  name?: string | null;
  store_id?: string | null;
}

export async function getContacts(token: string): Promise<Contact[]> {
  return authFetch(`${API_URL}/contacts`, token);
}

export async function addContact(token: string, contactId: string): Promise<{ status: string }> {
  return authFetch(`${API_URL}/contacts`, token, {
    method: "POST",
    body: JSON.stringify({ contact_id: contactId }),
  });
}

export async function removeContact(token: string, contactId: string): Promise<{ status: string }> {
  return authFetch(`${API_URL}/contacts/${contactId}`, token, {
    method: "DELETE",
  });
}

export async function blockContact(token: string, contactId: string): Promise<{ status: string; is_blocked: boolean }> {
  return authFetch(`${API_URL}/contacts/${contactId}/block`, token, {
    method: "POST",
  });
}

export async function unblockContact(token: string, contactId: string): Promise<{ status: string; is_blocked: boolean }> {
  return authFetch(`${API_URL}/contacts/${contactId}/unblock`, token, {
    method: "POST",
  });
}

export async function clearChatMessages(token: string, chatId: string): Promise<{ status: string; chat_id: string }> {
  return authFetch(`${API_URL}/chats/${chatId}/clear`, token, {
    method: "POST",
  });
}

export async function markChatRead(token: string, chatId: string): Promise<{ status: string }> {
  return authFetch(`${API_URL}/chats/${chatId}/read`, token, {
    method: "POST",
  });
}

export async function deleteMessageForEveryone(
  token: string,
  chatId: string,
  messageId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/chats/${chatId}/messages/${messageId}`, token, {
    method: "DELETE",
  });
}

export async function reactToMessage(
  token: string,
  chatId: string,
  messageId: string,
  reaction: string | null
): Promise<{ status: string; message_id: string; reaction: string | null }> {
  return authFetch(`${API_URL}/chats/${chatId}/messages/${messageId}/react`, token, {
    method: "POST",
    body: JSON.stringify({ reaction }),
  });
}

export async function deleteChat(token: string, chatId: string): Promise<{ status: string; chat_id: string }> {
  return authFetch(`${API_URL}/chats/${chatId}`, token, {
    method: "DELETE",
  });
}

export async function muteChat(
  token: string,
  chatId: string,
  mutedUntil: string | null,
  mutedForever: boolean
): Promise<{ status: string; chat_id: string }> {
  return authFetch(`${API_URL}/chats/${chatId}/mute`, token, {
    method: "POST",
    body: JSON.stringify({
      muted_until: mutedUntil,
      muted_forever: mutedForever,
    }),
  });
}

export async function archiveChat(
  token: string,
  chatId: string,
  isArchived: boolean
): Promise<{ status: string; chat_id: string; is_archived: boolean }> {
  return authFetch(`${API_URL}/chats/${chatId}/archive`, token, {
    method: "POST",
    body: JSON.stringify({
      is_archived: isArchived,
    }),
  });
}

export async function updateProfile(
  token: string,
  avatarUrl?: string | null,
  keepChatsArchived?: boolean,
  about?: string | null,
  name?: string | null,
  username?: string | null,
  privacyMessages?: string,
  privacyCalls?: string
): Promise<{
  status: string;
  avatar_url: string | null;
  keep_chats_archived?: boolean;
  about?: string | null;
  name?: string | null;
  username?: string | null;
  privacy_messages?: string;
  privacy_calls?: string;
}> {
  const body: any = {};
  if (avatarUrl !== undefined) body.avatar_url = avatarUrl;
  if (keepChatsArchived !== undefined) body.keep_chats_archived = keepChatsArchived;
  if (about !== undefined) body.about = about;
  if (name !== undefined) body.name = name;
  if (username !== undefined) body.username = username;
  if (privacyMessages !== undefined) body.privacy_messages = privacyMessages;
  if (privacyCalls !== undefined) body.privacy_calls = privacyCalls;
  return authFetch(`${API_URL}/users/profile`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface GroupParticipant {
  id: string;
  username: string;
  avatar_url?: string | null;
  name?: string | null;
}

export interface GroupDetails {
  id: string;
  name: string | null;
  created_by: string | null;
  is_group: boolean;
  avatar_url: string | null;
  description: string | null;
  participants: GroupParticipant[];
}

export async function getGroupDetails(
  token: string,
  chatId: string
): Promise<GroupDetails> {
  return authFetch(`${API_URL}/groups/${chatId}`, token);
}

export async function updateGroupDetails(
  token: string,
  chatId: string,
  updates: { name?: string; avatar_url?: string | null; description?: string | null }
): Promise<{ status: string; name: string | null; avatar_url: string | null; description: string | null }> {
  return authFetch(`${API_URL}/groups/${chatId}`, token, {
    method: "POST",
    body: JSON.stringify(updates),
  });
}

export async function addParticipant(
  token: string,
  chatId: string,
  userId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/groups/${chatId}/add`, token, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function removeParticipant(
  token: string,
  chatId: string,
  userId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/groups/${chatId}/remove/${userId}`, token, {
    method: "DELETE",
  });
}

export async function favoriteChat(
  token: string,
  chatId: string,
  isFavorite: boolean
): Promise<{ status: string; chat_id: string; is_favorite: boolean }> {
  return authFetch(`${API_URL}/chats/${chatId}/favorite`, token, {
    method: "POST",
    body: JSON.stringify({ is_favorite: isFavorite }),
  });
}

export interface ChatList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ChatListResponse {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  chat_ids: string[];
}

export async function getChatLists(
  token: string
): Promise<{ lists: ChatListResponse[] }> {
  return authFetch(`${API_URL}/chat-lists`, token);
}

export async function createChatList(
  token: string,
  name: string,
  color?: string,
  icon?: string
): Promise<{ list: ChatList; chat_ids: string[] }> {
  return authFetch(`${API_URL}/chat-lists`, token, {
    method: "POST",
    body: JSON.stringify({ name, color, icon }),
  });
}

export async function deleteChatList(
  token: string,
  listId: string
): Promise<{ status: string; id: string }> {
  return authFetch(`${API_URL}/chat-lists/${listId}`, token, {
    method: "DELETE",
  });
}

export async function updateChatLists(
  token: string,
  chatId: string,
  listIds: string[]
): Promise<{ status: string; chat_id: string; list_ids: string[] }> {
  return authFetch(`${API_URL}/chats/${chatId}/lists`, token, {
    method: "POST",
    body: JSON.stringify({ list_ids: listIds }),
  });
}

export async function updateChatList(
  token: string,
  listId: string,
  updates: {
    name?: string;
    color?: string | null;
    icon?: string | null;
    position?: number;
  }
): Promise<{ status: string; id: string }> {
  return authFetch(`${API_URL}/chat-lists/${listId}`, token, {
    method: "POST",
    body: JSON.stringify(updates),
  });
}



