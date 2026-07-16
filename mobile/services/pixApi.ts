import { authFetch, API_URL } from "./api";

export interface PixKeyData {
  id: string;
  user_id: string;
  pix_type: "celular" | "cpf" | "email" | "aleatoria";
  pix_value: string;
  full_name: string;
  visibility: "todos" | "contatos" | "ninguem";
  created_at: string;
  updated_at: string;
}

export async function getMyPixKey(
  token: string
): Promise<{ pix_key: PixKeyData | null }> {
  const data = await authFetch(`${API_URL}/pix/me`, token);
  // Normalize both { pix_key } and a bare PixKey object
  if (data && typeof data === "object") {
    if ("pix_key" in data) {
      return { pix_key: data.pix_key ?? null };
    }
    if (data.id && data.pix_value) {
      return { pix_key: data as PixKeyData };
    }
  }
  return { pix_key: null };
}

export async function createOrUpdatePixKey(
  token: string,
  pixType: string,
  pixValue: string,
  fullName: string,
  visibility?: string
): Promise<{ status: string; pix_key: PixKeyData }> {
  return authFetch(`${API_URL}/pix`, token, {
    method: "POST",
    body: JSON.stringify({
      pix_type: pixType,
      pix_value: pixValue,
      full_name: fullName,
      visibility,
    }),
  });
}

export async function updatePixKey(
  token: string,
  data: {
    pix_type?: string;
    pix_value?: string;
    full_name?: string;
    visibility?: string;
  }
): Promise<{ status: string; pix_key: PixKeyData }> {
  return authFetch(`${API_URL}/pix`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePixKey(
  token: string
): Promise<{ status: string; message: string }> {
  return authFetch(`${API_URL}/pix`, token, {
    method: "DELETE",
  });
}

export async function getUserPixKey(
  token: string,
  userId: string
): Promise<{ pix_key: PixKeyData | null }> {
  return authFetch(`${API_URL}/pix/${userId}`, token);
}

export const PIX_TYPE_LABELS: Record<string, string> = {
  celular: "Celular",
  cpf: "CPF",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

export const VISIBILITY_LABELS: Record<string, string> = {
  todos: "Todos",
  contatos: "Meus contatos",
  ninguem: "Ninguém",
};
