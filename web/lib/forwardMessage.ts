export interface ForwardedMessageData {
  sender_id: string;
  sender_username: string;
  content: string | null;
  image_url: string | null;
  local_file_path?: string | null;
  attachment_type?: "image" | "video" | "audio" | "document" | null;
  file_name?: string | null;
  file_size?: number | null;
}

const PIX_TYPE_LABELS: Record<string, string> = {
  celular: "Celular",
  cpf: "CPF",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

export function getForwardPreviewText(data: ForwardedMessageData): string {
  if (data.content) {
    try {
      const parsed = JSON.parse(data.content);
      if (parsed?.type === "contact_share") {
        return `Contato: ${parsed.username}`;
      }
      if (parsed?.type === "pix_share") {
        const label = PIX_TYPE_LABELS[parsed.pix_type] || "Chave Pix";
        return `Pix: ${label}: ${parsed.pix_value}`;
      }
      if (parsed?.type === "note_share") {
        return `Nota: ${parsed.title || "Sem título"}`;
      }
      if (parsed?.type === "forward" && parsed.forwarded) {
        return getForwardPreviewText(parsed.forwarded);
      }
    } catch {
      return data.content;
    }
    return data.content;
  }

  switch (data.attachment_type) {
    case "image":
      return "📷 Foto";
    case "video":
      return "🎥 Vídeo";
    case "audio":
      return "🎵 Áudio";
    case "document":
      return "📁 Arquivo";
    default:
      if (data.image_url || data.local_file_path) return "📎 Mídia";
      return "Mensagem";
  }
}

/** Resolve chat list preview: forwards become normal text/media labels. */
export function resolveLastMessagePreview(
  content: string | null | undefined
): string {
  if (!content) return "";

  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === "forward" && parsed.forwarded) {
      const caption =
        typeof parsed.text === "string" ? parsed.text.trim() : "";
      if (caption) return caption;
      return getForwardPreviewText(parsed.forwarded as ForwardedMessageData);
    }
    if (parsed?.type === "pix_share") {
      const label = PIX_TYPE_LABELS[parsed.pix_type] || "Chave Pix";
      return `Pix: ${label}: ${parsed.pix_value}`;
    }
    if (parsed?.type === "note_share") {
      return `Nota: ${parsed.title}`;
    }
  } catch {
    // plain text
  }

  return content;
}
