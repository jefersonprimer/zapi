import { authFetch, API_URL } from "./api";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export async function getNotes(token: string): Promise<Note[]> {
  return authFetch(`${API_URL}/notes`, token);
}

export async function getNote(
  token: string,
  noteId: string
): Promise<Note> {
  return authFetch(`${API_URL}/notes/${noteId}`, token);
}

export async function createNote(
  token: string,
  title: string,
  content: string
): Promise<Note> {
  return authFetch(`${API_URL}/notes`, token, {
    method: "POST",
    body: JSON.stringify({ title, content }),
  });
}

export async function updateNote(
  token: string,
  noteId: string,
  updates: { title?: string; content?: string; is_favorite?: boolean }
): Promise<Note> {
  return authFetch(`${API_URL}/notes/${noteId}`, token, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteNote(
  token: string,
  noteId: string
): Promise<{ status: string }> {
  return authFetch(`${API_URL}/notes/${noteId}`, token, {
    method: "DELETE",
  });
}
