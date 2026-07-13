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
