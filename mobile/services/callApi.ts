import { authFetch, API_URL } from "./api";

export interface CallHistoryItem {
  id: string;
  caller_id: string;
  caller_username: string;
  caller_avatar_url?: string | null;
  callee_id: string;
  callee_username: string;
  callee_avatar_url?: string | null;
  status: "completed" | "missed" | "rejected" | "failed" | "busy";
  duration: number; // in seconds
  created_at: string;
}

export async function startCallRequest(token: string, targetUserId: string): Promise<{ call_id: string }> {
  return authFetch(`${API_URL}/calls/start`, token, {
    method: "POST",
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
}

export async function endCallRequest(token: string, callId: string): Promise<{ status: string; duration: number }> {
  return authFetch(`${API_URL}/calls/end`, token, {
    method: "POST",
    body: JSON.stringify({ call_id: callId }),
  });
}

export async function getCallHistory(token: string): Promise<CallHistoryItem[]> {
  return authFetch(`${API_URL}/calls/history`, token);
}

export async function deleteCallHistoryItem(token: string, callId: string): Promise<{ status: string }> {
  return authFetch(`${API_URL}/calls/${callId}`, token, {
    method: "DELETE",
  });
}
