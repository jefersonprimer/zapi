export interface FileValidationResult {
  valid: boolean;
  maxBytes: number;
  label: string;
}

/**
 * Validates whether an attachment's size is within limits.
 *
 * Limits:
 * - Image: 20MB
 * - Video: 250MB
 * - Document: 500MB
 * - Voice message: 25MB
 * - Generic audio: 50MB
 */
export function validateAttachmentSize(
  size: number,
  type: "image" | "video" | "audio" | "document",
  name: string,
  mimeType: string = ""
): FileValidationResult {
  let maxBytes = 0;
  let label = "";

  if (type === "image") {
    maxBytes = 20 * 1024 * 1024;
    label = "fotos (máx 20MB)";
  } else if (type === "video") {
    maxBytes = 250 * 1024 * 1024;
    label = "vídeos (máx 250MB)";
  } else if (type === "document") {
    maxBytes = 500 * 1024 * 1024;
    label = "documentos (máx 500MB)";
  } else if (type === "audio") {
    const isVoiceMsg =
      name.startsWith("audio_") ||
      mimeType === "audio/m4a" ||
      mimeType === "audio/aac" ||
      mimeType === "audio/3gp";
    if (isVoiceMsg) {
      maxBytes = 25 * 1024 * 1024;
      label = "mensagens de voz (máx 25MB)";
    } else {
      maxBytes = 50 * 1024 * 1024;
      label = "áudios (máx 50MB)";
    }
  }

  return {
    valid: size <= maxBytes,
    maxBytes,
    label,
  };
}

export const isImageUrl = (url: string): boolean =>
  /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.split("?")[0]) ||
  url.includes("gstatic.com") ||
  url.includes("google.com/images") ||
  url.includes("googleusercontent.com") ||
  url.includes("data:image/") ||
  url.includes("data:image/svg+xml") ||
  url.includes("tbn:") ||
  url.includes("/uploads/images");

export const isSvgUrl = (url: string): boolean =>
  /\.(svg)$/i.test(url.split("?")[0]) ||
  url.includes("image/svg+xml") ||
  url.includes("data:image/svg+xml");

export const getYoutubeId = (url: string): string | null => {
  if (!url) return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export const isAudioUrl = (url: string): boolean =>
  /\.(m4a|mp3|wav|caf|ogg|3gp|opus)$/i.test(url.split("?")[0]) ||
  url.includes("data:audio/") ||
  url.includes("/uploads/audio");

export const isVideoUrl = (url: string): boolean =>
  /\.(mp4|mov|webm|mkv|avi|quicktime|qt|3gp|m4v|flv|wmv|mpg|mpeg)$/i.test(
    url.split("?")[0],
  ) ||
  url.includes("data:video/") ||
  url.includes("/uploads/videos") ||
  url.includes("gstatic.com/video") ||
  url.includes("video?q=tbn");

export const formatFileSize = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const getFileExtensionLabel = (name: string | null | undefined): string => {
  if (!name) return "";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === name.length - 1) return "";
  return name.substring(dotIndex + 1).toUpperCase();
};

