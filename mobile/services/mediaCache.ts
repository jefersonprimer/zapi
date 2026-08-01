import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { API_URL } from "./api";
import { getDatabase } from "./database";

// Returns the full remote URL if it's a relative path
export function getFullRemoteUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
    return url;
  }
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// Determines the subfolder and returns local file path
export function getLocalPathForUrl(remoteUrl: string): string | null {
  if (Platform.OS === "web" || !remoteUrl) return null;
  if (remoteUrl.startsWith("file://")) return remoteUrl;

  const urlPath = remoteUrl.split("?")[0];
  let filename = urlPath.substring(urlPath.lastIndexOf("/") + 1);
  if (!filename) return null;

  let ext = filename.split(".").pop()?.toLowerCase() || "bin";

  // If the filename has no valid extension (e.g. Google gstatic /images URL)
  if (!["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm", "mp3", "wav", "m4a", "pdf", "txt"].includes(ext)) {
    const hash = simpleHash(remoteUrl);
    const isVid = remoteUrl.toLowerCase().includes("video") || remoteUrl.toLowerCase().includes("mp4");
    ext = isVid ? "mp4" : "jpg";
    filename = `web_${hash}.${ext}`;
  }

  let subfolder = "documents";

  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    subfolder = "images";
  } else if (["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
    subfolder = "videos";
  } else if (["mp3", "wav", "caf", "ogg", "3gp", "aac", "m4a", "opus"].includes(ext)) {
    subfolder = "audio";
  }

  return Paths.join(Paths.document, "media", subfolder, filename);
}

const failedUrls = new Set<string>();

// Caches the media file and optionally updates the SQLite DB
export async function cacheMediaFile(remoteUrl: string, messageId?: string): Promise<string> {
  if (Platform.OS === "web" || !remoteUrl) {
    return getFullRemoteUrl(remoteUrl);
  }

  // Already a local file
  if (remoteUrl.startsWith("file://") || remoteUrl.startsWith("content://")) {
    return remoteUrl;
  }

  if (failedUrls.has(remoteUrl)) {
    return getFullRemoteUrl(remoteUrl);
  }

  const localUri = getLocalPathForUrl(remoteUrl);
  if (!localUri) return getFullRemoteUrl(remoteUrl);

  try {
    const file = new File(localUri);
    // Check if file already exists
    if (file.exists) {
      return localUri;
    }

    // Ensure parent directory exists
    const parentDir = file.parentDirectory;
    if (!parentDir.exists) {
      parentDir.create({ intermediates: true, idempotent: true });
    }

    // Download file
    const downloadUrl = getFullRemoteUrl(remoteUrl);
    await File.downloadFileAsync(downloadUrl, file, { idempotent: true });

    if (true) {
      // Update SQLite database with local file path
      if (messageId) {
        try {
          const db = await getDatabase();
          await db.runAsync("UPDATE messages SET local_file_path = ? WHERE id = ?", [
            localUri,
            messageId,
          ]);
          
          // Also update the attachments table if it contains this remote URL
          await db.runAsync(
            "UPDATE attachments SET local_path = ?, download_status = 'downloaded' WHERE message_id = ? AND remote_url = ?",
            [localUri, messageId, remoteUrl]
          );
        } catch (dbErr) {
          console.warn("Failed to update local_file_path/attachments in SQLite:", dbErr);
        }
      }
      return localUri;
    }
  } catch (err) {
    console.warn("Error caching media file:", err);
    failedUrls.add(remoteUrl);
  }

  // Fallback to full remote URL on error
  return getFullRemoteUrl(remoteUrl);
}
