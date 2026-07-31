import { File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { getMessages, sendMessage, type Message, uploadFile, checkFileHash } from "./api";
import {
  getMessagesFromLocal,
  saveMessages,
  getPendingMessages,
  getDatabase
} from "./database";

type ChangeCallback = () => void;

class SyncWorker {
  private listeners = new Map<string, Set<ChangeCallback>>();
  private syncQueue = new Set<string>();
  private activeSyncing = new Set<string>();
  private token: string | null = null;
  private retryDelays = new Map<string, number>(); // messageId -> delay in ms
  private isProcessingQueue = false;
  private periodicSyncInterval: ReturnType<typeof setInterval> | null = null;

  init(token: string) {
    this.token = token;
    this.startPeriodicSync();
  }

  disconnect() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
    this.token = null;
    this.syncQueue.clear();
    this.activeSyncing.clear();
    this.retryDelays.clear();
    this.isProcessingQueue = false;
  }

  // Subscribe to local message changes for a specific chat
  onMessagesChanged(chatId: string, callback: ChangeCallback): () => void {
    if (!this.listeners.has(chatId)) {
      this.listeners.set(chatId, new Set());
    }
    this.listeners.get(chatId)!.add(callback);

    return () => {
      const chatListeners = this.listeners.get(chatId);
      if (chatListeners) {
        chatListeners.delete(callback);
        if (chatListeners.size === 0) {
          this.listeners.delete(chatId);
        }
      }
    };
  }

  // Notify UI listeners that SQLite has updated data
  notifyMessagesChanged(chatId: string) {
    const chatListeners = this.listeners.get(chatId);
    if (chatListeners) {
      chatListeners.forEach((cb) => cb());
    }
  }

  // Trigger immediate sync for a specific chat
  triggerSync(chatId: string) {
    this.syncQueue.add(chatId);
    this.processQueue();
  }

  // Start periodic background sync for all active chats (e.g. every 10 seconds)
  private startPeriodicSync() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
    }
    this.periodicSyncInterval = setInterval(() => {
      // Trigger sync for all chats that currently have listeners (visible chats)
      for (const chatId of this.listeners.keys()) {
        this.triggerSync(chatId);
      }
    }, 10000);
  }

  private async processQueue() {
    if (this.isProcessingQueue || !this.token) return;
    this.isProcessingQueue = true;

    try {
      while (this.syncQueue.size > 0) {
        const chatId = this.syncQueue.values().next().value;
        if (!chatId) {
          // If queue returned undefined (empty), clear the queue and break the loop
          this.syncQueue.clear();
          break;
        }
        this.syncQueue.delete(chatId);

        if (this.activeSyncing.has(chatId)) continue;
        this.activeSyncing.add(chatId);

        try {
          await this.syncChat(chatId);
        } catch (err) {
          console.error(`SyncWorker: Error syncing chat ${chatId}:`, err);
        } finally {
          this.activeSyncing.delete(chatId);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async syncChat(chatId: string) {
    if (!this.token) return;

    // 1. Process and upload/send any pending/failed messages in this chat
    await this.sendPendingMessages(chatId);

    // 2. Fetch incremental (delta) sync from the server
    await this.fetchDeltaMessages(chatId);
  }

  private async sendPendingMessages(chatId: string) {
    if (!this.token) return;
    const db = await getDatabase();

    // Fetch local pending messages for this chat
    const pending = await db.getAllAsync<any>(
      "SELECT * FROM messages WHERE chat_id = ? AND (status = 'pending' OR status = 'failed' OR status = 'uploading')",
      [chatId]
    );

    for (const msg of pending) {
      // Exponential Backoff check
      const nextAttempt = this.retryDelays.get(msg.id + "_time");
      if (nextAttempt && Date.now() < nextAttempt) {
        continue;
      }

      try {
        // Update status to 'sending' in SQLite
        await db.runAsync(
          "UPDATE messages SET status = 'sending' WHERE id = ?",
          [msg.id]
        );
        this.notifyMessagesChanged(chatId);

        // Treat empty remote URLs as missing (null)
        let remoteImageUrl: string | null = (msg.image_url && msg.image_url.trim() !== "") ? msg.image_url : null;
        let fileHashStr: string | null = null;

        // Fetch attachment details to resolve local path if needed
        const attachment = await db.getFirstAsync<any>(
          "SELECT * FROM attachments WHERE message_id = ?",
          [msg.id]
        );

        // Resolve local file path from message or attachment
        let localFilePath: string | null = msg.local_file_path;
        if (!localFilePath && attachment?.local_path) {
          localFilePath = attachment.local_path;
        }

        console.log(`[SyncWorker] Processing pending message ${msg.id}: status="${msg.status}", content="${msg.content || ""}", localFilePath="${localFilePath || "null"}"`);

        // Check if the file actually exists if we have a local path
        let fileExists = false;
        if (localFilePath) {
          if (
            localFilePath.startsWith("content://") ||
            localFilePath.startsWith("ph://") ||
            localFilePath.startsWith("assets-library://") ||
            localFilePath.startsWith("assets-carousels://") ||
            localFilePath.startsWith("http://") ||
            localFilePath.startsWith("https://")
          ) {
            fileExists = true; // Native URIs and web links are assumed to exist/accessible
            console.log(`[SyncWorker] File assumed to exist (native/web scheme): ${localFilePath}`);
          } else {
            try {
              const info = await FileSystem.getInfoAsync(localFilePath);
              fileExists = info.exists;
              console.log(`[SyncWorker] getInfoAsync for ${localFilePath}: exists=${info.exists}, isDirectory=${info.isDirectory}`);
            } catch (infoErr: any) {
              console.error(`[SyncWorker] getInfoAsync error for ${localFilePath}:`, infoErr?.message || infoErr);
              fileExists = false;
            }
          }
        }

        // Prevent infinite retries of invalid/corrupt pending messages that have no content and no valid local media
        if (!remoteImageUrl && !fileExists && (!msg.content || msg.content.trim() === "")) {
          console.warn(`[SyncWorker] Marking invalid pending message ${msg.id} as failed (missing local file: "${localFilePath || "null"}" and no text content)`);
          await db.runAsync(
            "UPDATE messages SET status = 'failed' WHERE id = ?",
            [msg.id]
          );
          // Prevent immediate retry loop by setting a very long delay (e.g. 30 days)
          this.retryDelays.set(msg.id + "_time", Date.now() + 30 * 24 * 60 * 60 * 1000);
          this.notifyMessagesChanged(chatId);
          continue;
        }

        // Copy media into a durable cache before sync if it is a temporary picker/local path
        if (
          localFilePath &&
          (localFilePath.startsWith("file://") ||
            localFilePath.startsWith("content://") ||
            localFilePath.startsWith("ph://") ||
            localFilePath.startsWith("assets-library://") ||
            localFilePath.startsWith("assets-carousels://"))
        ) {
          const durablePrefix = Paths.join(Paths.document, "media");
          const isDurable = localFilePath.startsWith(durablePrefix);
          if (!isDurable) {
            try {
              // Determine file extension
              let ext = "bin";
              if (attachment?.mime_type) {
                ext = attachment.mime_type.split("/")[1] || "bin";
                if (ext === "jpeg") ext = "jpg";
              } else {
                const uriParts = localFilePath.split("/");
                const filename = uriParts[uriParts.length - 1] || "file";
                ext = filename.split(".").pop()?.toLowerCase() || "bin";
              }
              
              let subfolder = "documents";
              if (attachment?.type === "image" || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
                subfolder = "images";
              } else if (attachment?.type === "video" || ["mp4", "mov", "webm", "mkv", "avi"].includes(ext)) {
                subfolder = "videos";
              } else if (attachment?.type === "audio" || ["mp3", "wav", "caf", "ogg", "3gp", "aac", "m4a", "opus"].includes(ext)) {
                subfolder = "audio";
              }

              const destFilename = `${msg.id}.${ext}`;
              const destDir = Paths.join(Paths.document, "media", subfolder);
              const destPath = Paths.join(destDir, destFilename);

              const destFile = new File(destPath);
              const parentDir = destFile.parentDirectory;
              if (!parentDir.exists) {
                parentDir.create({ intermediates: true, idempotent: true });
              }

              // Since content:// URIs are not visible to new File().exists, we copy the file first
              console.log(`[SyncWorker] Copying temporary local media to durable cache using copyAsync: ${localFilePath} -> ${destPath}`);
              await FileSystem.copyAsync({ from: localFilePath, to: destPath });

              localFilePath = destPath;

              // Update database: messages and attachments tables
              await db.runAsync(
                "UPDATE messages SET local_file_path = ? WHERE id = ?",
                [destPath, msg.id]
              );
              if (attachment) {
                await db.runAsync(
                  "UPDATE attachments SET local_path = ? WHERE id = ?",
                  [destPath, attachment.id]
                );
              }
            } catch (copyErr) {
              console.error("SyncWorker: Failed to copy file to durable cache:", copyErr);
            }
          }
        }

        // If there's a local file path but no remote image url, upload it first
        if (localFilePath && !remoteImageUrl) {
          if (localFilePath.startsWith("http://") || localFilePath.startsWith("https://")) {
            remoteImageUrl = localFilePath;
          } else {
            console.log(`[SyncWorker] Uploading local file for message ${msg.id}: ${localFilePath}`);
            await db.runAsync(
              "UPDATE messages SET status = 'uploading' WHERE id = ?",
              [msg.id]
            );
            this.notifyMessagesChanged(chatId);

            try {
              if (localFilePath.startsWith("file://")) {
                const file = new File(localFilePath);
                // Limit MD5 calculation to files under 20MB to prevent OutOfMemoryError on large files
                if (file.exists && file.size < 20 * 1024 * 1024 && file.md5) {
                  fileHashStr = file.md5;
                }
              }
            } catch (hashErr) {
              console.error("SyncWorker: Failed to compute MD5 hash for local file:", hashErr);
            }

          let existsOnServer = false;
          if (fileHashStr) {
            try {
              const checkRes = await checkFileHash(this.token, fileHashStr);
              if (checkRes.exists && checkRes.url) {
                remoteImageUrl = checkRes.url;
                existsOnServer = true;
                console.log(`[SyncWorker] File hash matched on server. Reusing URL: ${remoteImageUrl}`);
              }
            } catch (checkErr) {
              console.warn("SyncWorker: Check file hash failed, falling back to upload:", checkErr);
            }
          }

          if (!existsOnServer) {
            let uploadName: string | undefined = undefined;
            let uploadType: string | undefined = undefined;

            if (attachment) {
              uploadType = attachment.mime_type || undefined;
              const uriParts = localFilePath.split("/");
              let filename = uriParts[uriParts.length - 1];
              if (attachment.mime_type && !filename.includes(".")) {
                const ext = attachment.mime_type.split("/")[1] || "bin";
                filename = `${filename}.${ext}`;
              }
              uploadName = filename;
            } else {
              // Guess from uri filename
              const uriParts = localFilePath.split("/");
              const filename = uriParts[uriParts.length - 1];
              uploadName = filename;
              
              const ext = filename.split(".").pop()?.toLowerCase();
              if (ext) {
                if (["jpg", "jpeg"].includes(ext)) uploadType = "image/jpeg";
                else if (ext === "png") uploadType = "image/png";
                else if (ext === "gif") uploadType = "image/gif";
                else if (ext === "webp") uploadType = "image/webp";
                else if (ext === "mp4") uploadType = "video/mp4";
                else if (ext === "mov") uploadType = "video/quicktime";
                else if (ext === "mkv") uploadType = "video/x-matroska";
                else if (ext === "avi") uploadType = "video/x-msvideo";
                else if (ext === "mp3") uploadType = "audio/mpeg";
                else if (ext === "wav") uploadType = "audio/wav";
                else if (ext === "m4a") uploadType = "audio/mp4";
                else if (ext === "pdf") uploadType = "application/pdf";
              }
            }

            console.log(`[SyncWorker] Invoking uploadFile: name=${uploadName}, type=${uploadType}`);
            const result = await uploadFile(this.token, localFilePath, uploadName, uploadType);
            remoteImageUrl = result.url;
            console.log(`[SyncWorker] File uploaded successfully. Remote URL: ${remoteImageUrl}`);
          }
        }
      }

        console.log(`[SyncWorker] Sending message to server: content="${msg.content || ""}", remoteImageUrl="${remoteImageUrl || ""}"`);
        const res = await sendMessage(
          this.token,
          chatId,
          msg.content || "",
          remoteImageUrl || undefined,
          fileHashStr || undefined
        );

        const serverMsg = res.message;

        // Replace temporary local message with the official server-generated message in SQLite
        await db.runAsync(
          "DELETE FROM messages WHERE id = ?",
          [msg.id]
        );

        // Save server message locally
        await saveMessages([{
          ...serverMsg,
          // Retain local image path for caching / instant loading
          local_file_path: localFilePath
        }]);

        // Clear retry delay on success
        this.retryDelays.delete(msg.id);
        this.retryDelays.delete(msg.id + "_time");

        this.notifyMessagesChanged(chatId);
      } catch (err: any) {
        console.error(`SyncWorker: Failed to send message ${msg.id}:`, err);

        const errCode = err?.code || err?.message || "";
        const isPermanentError =
          errCode === "privacy_messages_nobody" ||
          errCode === "privacy_messages_contacts" ||
          errCode === "chat_blocked";

        if (isPermanentError) {
          // Mark with permanent error status so we stop retrying
          await db.runAsync(
            "UPDATE messages SET status = ? WHERE id = ?",
            [errCode, msg.id]
          );
        } else {
          // Calculate next retry delay (exponential backoff)
          const lastDelay = this.retryDelays.get(msg.id) || 500; // start with 1s after doubling
          const nextDelay = Math.min(lastDelay * 2, 60000);

          this.retryDelays.set(msg.id, nextDelay);
          this.retryDelays.set(msg.id + "_time", Date.now() + nextDelay);

          // Reset status to 'failed'
          await db.runAsync(
            "UPDATE messages SET status = 'failed' WHERE id = ?",
            [msg.id]
          );
        }
        this.notifyMessagesChanged(chatId);
      }
    }
  }

  private async fetchDeltaMessages(chatId: string) {
    if (!this.token) return;
    const db = await getDatabase();

    // Determine the maximum created_at timestamp of local messages in this chat
    const row = await db.getFirstAsync<{ max_created_at: string }>(
      "SELECT MAX(created_at) as max_created_at FROM messages WHERE chat_id = ? AND status != 'pending' AND status != 'failed' AND status != 'uploading' AND status != 'sending'",
      [chatId]
    );

    const since = row?.max_created_at || null;

    // Fetch delta messages from the server
    const data = await getMessages(this.token, chatId, since);

    if (data.messages && data.messages.length > 0) {
      await saveMessages(data.messages);
      this.notifyMessagesChanged(chatId);
    }
  }
}

export const syncWorker = new SyncWorker();
