import { File } from "expo-file-system";
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

        let remoteImageUrl: string | null = msg.image_url;
        let fileHashStr: string | null = null;

        // If there's a local file path but no remote image url, upload it first
        if (msg.local_file_path && !remoteImageUrl) {
          await db.runAsync(
            "UPDATE messages SET status = 'uploading' WHERE id = ?",
            [msg.id]
          );
          this.notifyMessagesChanged(chatId);

          // Fetch attachment details to get mime_type and type
          const attachment = await db.getFirstAsync<any>(
            "SELECT * FROM attachments WHERE message_id = ?",
            [msg.id]
          );

          try {
            const file = new File(msg.local_file_path);
            // Limit MD5 calculation to files under 20MB to prevent OutOfMemoryError on large files
            if (file.exists && file.size < 20 * 1024 * 1024 && file.md5) {
              fileHashStr = file.md5;
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
              const uriParts = msg.local_file_path.split("/");
              let filename = uriParts[uriParts.length - 1];
              if (attachment.mime_type && !filename.includes(".")) {
                const ext = attachment.mime_type.split("/")[1] || "bin";
                filename = `${filename}.${ext}`;
              }
              uploadName = filename;
            } else {
              // Guess from uri filename
              const uriParts = msg.local_file_path.split("/");
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

            const result = await uploadFile(this.token, msg.local_file_path, uploadName, uploadType);
            remoteImageUrl = result.url;
          }
        }

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
          local_file_path: msg.local_file_path
        }]);

        // Clear retry delay on success
        this.retryDelays.delete(msg.id);
        this.retryDelays.delete(msg.id + "_time");

        this.notifyMessagesChanged(chatId);
      } catch (err) {
        console.error(`SyncWorker: Failed to send message ${msg.id}:`, err);

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
