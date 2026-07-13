import type { Message } from "@/services/api";

export interface ForwardedMessageData {
  sender_id: string;
  sender_username: string;
  content: string | null;
  image_url: string | null;
  local_file_path?: string | null;
  attachment_type?: "image" | "video" | "audio" | "document" | null;
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
    } catch {
      // plain text
    }
  }

  return {
    sender_id: msg.sender_id,
    sender_username: msg.sender_username,
    content,
    image_url: msg.image_url,
    local_file_path: msg.local_file_path,
    attachment_type: attachment?.type ?? null,
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

export function getForwardPreviewText(data: ForwardedMessageData): string {
  if (data.content) {
    try {
      const parsed = JSON.parse(data.content);
      if (parsed?.type === "contact_share") {
        return `Contato: ${parsed.username}`;
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
  } catch {
    // plain text
  }

  return content;
}
