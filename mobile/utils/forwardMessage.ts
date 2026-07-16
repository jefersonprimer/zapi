import type { Message } from "@/services/api";

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

export interface ForwardMessageContent {
  type: "forward";
  forwarded: ForwardedMessageData;
  text?: string | null;
}

export function extractForwardData(msg: Message): ForwardedMessageData {
  const attachment =
    msg.attachments && msg.attachments.length > 0 ? msg.attachments[0] : null;

  let content = msg.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === "forward") {
        return parsed.forwarded;
      }
      if (parsed?.type === "contact_share") {
        content = `Contato: ${parsed.username}`;
      }
      if (parsed?.type === "pix_share") {
        const label = PIX_TYPE_LABELS[parsed.pix_type] || "Chave Pix";
        content = `Pix: ${label}: ${parsed.pix_value}`;
      }
    } catch {
      // plain text
    }
  }

  let fileName: string | null = null;
  const mediaUrl = msg.local_file_path || msg.image_url;
  if (mediaUrl) {
    const rawFileName = mediaUrl.split("/").pop() || "";
    const match = rawFileName.match(/^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/);
    if (match) {
      fileName = match[1];
    } else {
      const oldMatch = rawFileName.match(/^[^_]+_([0-9a-fA-F\-]{36}\..+)$/);
      fileName = oldMatch ? oldMatch[1] : rawFileName;
    }
  }

  return {
    sender_id: msg.sender_id,
    sender_username: msg.sender_username,
    content,
    image_url: msg.image_url,
    local_file_path: msg.local_file_path,
    attachment_type: attachment?.type ?? null,
    file_name: fileName,
    file_size: attachment?.size ?? null,
  };
}

export function buildForwardContent(
  forwarded: ForwardedMessageData,
  text?: string | null,
): string {
  const payload: ForwardMessageContent = {
    type: "forward",
    forwarded,
    text: text?.trim() || null,
  };
  return JSON.stringify(payload);
}

export function parseForwardContent(
  content: string | null,
): ForwardMessageContent | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === "forward" && parsed.forwarded) {
      return parsed as ForwardMessageContent;
    }
  } catch {
    // not forward content
  }
  return null;
}

export interface NoteShareData {
  note_id: string;
  title: string;
  content: string;
}

export function parseNoteShareContent(
  content: string | null | undefined,
): NoteShareData | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === "note_share") {
      return {
        note_id: parsed.note_id,
        title: parsed.title || "Sem título",
        content: parsed.content || "",
      };
    }
  } catch {
    // plain text
  }
  return null;
}

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

const PIX_TYPE_LABELS: Record<string, string> = {
  celular: "Celular",
  cpf: "CPF",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

/** Resolve chat list preview: forwards become normal text/media labels. */
export function resolveLastMessagePreview(
  content: string | null | undefined,
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
