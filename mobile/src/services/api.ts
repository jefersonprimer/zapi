const API_URL = "http://192.168.5.22:3000";

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
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_username: string;
  content: string;
  image_url: string | null;
  created_at: string;
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
  formData.append("file", {
    uri,
    type: type || "image/jpeg",
    name: name || "photo.jpg",
  } as any);

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
