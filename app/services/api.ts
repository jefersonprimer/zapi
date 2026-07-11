import { Platform } from "react-native";
import Constants from "expo-constants";

export const API_URL = (() => {
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
}

export interface ChatListItem {
  id: string;
  participant_id: string | null;
  participant_username: string | null;
  is_group: boolean;
  name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
  is_blocked_by_me?: boolean;
  is_blocked_by_them?: boolean;
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
  local_file_path?: string | null; // Local cached file URI
  status?: "pending" | "uploading" | "uploaded" | "sending" | "sent" | "delivered" | "read" | "failed"; // Delivery status
  created_at: string;
  deleted_for_everyone?: boolean;
  attachments?: Attachment[];
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

  if (!res.ok) throw new Error(data.error ?? "Request failed");
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

export async function getChats(token: string): Promise<{ chats: ChatListItem[] }> {
  return authFetch(`${API_URL}/chats`, token);
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
  chatId: string
): Promise<{ messages: Message[] }> {
  return authFetch(`${API_URL}/chats/${chatId}/messages`, token);
}

export interface UserSearchResult {
  id: string;
  username: string;
  email: string;
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

export async function sendMessage(
  token: string,
  chatId: string,
  content: string,
  imageUrl?: string
): Promise<{ message: Message }> {
  return authFetch(`${API_URL}/chats/${chatId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content: content || null, image_url: imageUrl || null }),
  });
}

export interface Contact {
  contact_id: string;
  username: string;
  email: string;
  is_blocked: boolean;
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

