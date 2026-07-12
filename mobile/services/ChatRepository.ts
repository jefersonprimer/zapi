import { Platform } from "react-native";
import { 
  getChats as fetchChatsApi, 
  getMessages as fetchMessagesApi, 
  sendMessage as sendMessageApi, 
  uploadFile,
  type Message, 
  type ChatListItem,
  type Attachment
} from "./api";
import { 
  getChatsFromLocal, 
  getMessagesFromLocal, 
  saveChats, 
  saveMessages, 
  insertMessageLocal, 
  updateMessageStatusLocal,
  getPendingMessages as getPendingMessagesLocal,
  markChatReadLocal
} from "./database";
import { generateUUIDv7 } from "./uuidv7";
import { cacheMediaFile } from "./mediaCache";

export interface SendMessageOptions {
  content: string | null;
  attachment?: {
    uri: string;
    name: string;
    type: "image" | "video" | "audio" | "document";
    mimeType?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
  };
}

class ChatRepository {
  private isSyncing = false;

  /**
   * Loads chats from local SQLite database immediately for fast UI loading (Offline-first),
   * and triggers an incremental network sync in the background to keep it up to date.
   */
  async getChats(token: string, onUpdate?: (chats: ChatListItem[]) => void): Promise<ChatListItem[]> {
    // 1. Fetch locally cached chats
    const localChats = await getChatsFromLocal();
    if (onUpdate && localChats.length > 0) {
      onUpdate(localChats);
    }

    // 2. Fetch remote chats in the background (Incremental sync)
    try {
      const response = await fetchChatsApi(token);
      if (response && response.chats) {
        await saveChats(response.chats);
        const updatedChats = await getChatsFromLocal();
        if (onUpdate) {
          onUpdate(updatedChats);
        }
        return updatedChats;
      }
    } catch (err) {
      console.warn("[ChatRepository] Background chats sync failed:", err);
    }

    return localChats;
  }

  /**
   * Retrieves messages for a chat with support for Keys/Offset Pagination.
   * Returns locally stored messages immediately, and syncs from network incrementally in background.
   */
  async getMessages(
    chatId: string, 
    token: string, 
    options?: { limit?: number; offset?: number },
    onUpdate?: (messages: Message[]) => void
  ): Promise<Message[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // 1. Load from local database immediately
    const localMessages = await getMessagesFromLocal(chatId, limit, offset);
    if (onUpdate && localMessages.length > 0) {
      onUpdate(localMessages);
    }

    // 2. Fetch new messages from server incrementally
    try {
      // In a fully incremental sync, we could pass the last message timestamp to avoid downloading all.
      // E.g., fetchMessagesApi(token, chatId, { since: lastMessageTimestamp })
      const response = await fetchMessagesApi(token, chatId);
      if (response && response.messages) {
        await saveMessages(response.messages);
        
        // Load updated messages with the same pagination bounds
        const updatedMessages = await getMessagesFromLocal(chatId, limit, offset);
        if (onUpdate) {
          onUpdate(updatedMessages);
        }
        return updatedMessages;
      }
    } catch (err) {
      console.warn("[ChatRepository] Background messages sync failed:", err);
    }

    return localMessages;
  }

  /**
   * Enqueues a message to be sent. Inserts it into SQLite immediately with a UUIDv7 ID and a 'pending' state
   * (or 'uploading' if it has an attachment). Then kicks off the background Sync Worker to upload
   * attachments and deliver the message.
   */
  async sendMessage(
    chatId: string, 
    token: string, 
    senderId: string, 
    senderUsername: string,
    options: SendMessageOptions
  ): Promise<Message> {
    const messageId = generateUUIDv7();
    const createdAt = new Date().toISOString();
    
    let localAttachments: Attachment[] = [];
    
    if (options.attachment) {
      const attId = generateUUIDv7();
      localAttachments.push({
        id: attId,
        message_id: messageId,
        type: options.attachment.type,
        remote_url: "", // Not uploaded yet
        local_path: options.attachment.uri,
        mime_type: options.attachment.mimeType || null,
        width: options.attachment.width || null,
        height: options.attachment.height || null,
        duration: options.attachment.duration || null,
        size: options.attachment.size || null,
        sha256: null,
        thumbnail_path: null,
        download_status: "downloaded" // Original sender already has the local file
      });
    }

    const newLocalMsg: Message = {
      id: messageId,
      chat_id: chatId,
      sender_id: senderId,
      sender_username: senderUsername,
      content: options.content,
      image_url: localAttachments[0]?.remote_url || null,
      local_file_path: localAttachments[0]?.local_path || null,
      created_at: createdAt,
      status: options.attachment ? "uploading" : "pending",
      deleted_for_everyone: false,
      attachments: localAttachments
    };

    // 1. Save locally in SQLite immediately
    await insertMessageLocal(newLocalMsg);

    // 2. Trigger the Sync Worker in the background
    this.syncPendingMessages(token).catch(err => {
      console.error("[ChatRepository] Sync worker failed to process:", err);
    });

    return newLocalMsg;
  }

  /**
   * Background Sync Worker. Resolves pending uploads, retries failed messages, and keeps
   * the local database synchronized with the remote server.
   */
  async syncPendingMessages(token: string): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pending = await getPendingMessagesLocal();
      if (pending.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncWorker] Found ${pending.length} pending/uploading messages to synchronize`);

      for (const msg of pending) {
        try {
          let remoteAttachmentUrl = msg.image_url;
          let attachmentsToUpdate: Attachment[] = [];
          
          // Fetch local attachments for this message to check if they need uploading
          const localMessagesWithAttachments = await getMessagesFromLocal(msg.chat_id);
          const currentMsg = localMessagesWithAttachments.find(m => m.id === msg.id);
          const firstAtt = currentMsg?.attachments?.[0];

          // 1. Handle file upload if it hasn't been uploaded yet
          if (firstAtt && !firstAtt.remote_url) {
            await updateMessageStatusLocal(msg.id, "uploading");
            
            const mimeType = firstAtt.mime_type || "application/octet-stream";
            console.log(`[SyncWorker] Uploading attachment: ${firstAtt.local_path}`);
            
            const uploadRes = await uploadFile(token, firstAtt.local_path!, firstAtt.local_path!.split("/").pop(), mimeType);
            remoteAttachmentUrl = uploadRes.url;

            // Prepare the updated attachment object
            const updatedAtt: Attachment = {
              ...firstAtt,
              remote_url: remoteAttachmentUrl,
              download_status: "downloaded"
            };
            attachmentsToUpdate.push(updatedAtt);
          }

          // 2. Send the message payload to the server
          await updateMessageStatusLocal(msg.id, "sending");
          console.log(`[SyncWorker] Delivering message to server: ${msg.id}`);

          const response = await sendMessageApi(
            token,
            msg.chat_id,
            msg.content || "",
            remoteAttachmentUrl || undefined
          );

          // 3. Update SQLite with definitive server ID, status = 'sent', and attachment urls
          if (response && response.message) {
            const serverMsg = response.message;
            
            // Map attachments remote url if updated
            if (attachmentsToUpdate.length > 0) {
              attachmentsToUpdate = attachmentsToUpdate.map(a => ({
                ...a,
                message_id: serverMsg.id
              }));
            }

            await updateMessageStatusLocal(msg.id, "sent", {
              serverId: serverMsg.id,
              image_url: remoteAttachmentUrl,
              attachments: attachmentsToUpdate
            });

            console.log(`[SyncWorker] Message delivered successfully. Temp ID: ${msg.id} -> Server ID: ${serverMsg.id}`);
          }
        } catch (msgErr) {
          console.error(`[SyncWorker] Failed to sync message ${msg.id}:`, msgErr);
          await updateMessageStatusLocal(msg.id, "failed");
        }
      }
    } catch (err) {
      console.error("[SyncWorker] Error in sync process:", err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Smart download of media files. Only downloads when requested or if conditions are met
   * (e.g. WiFi active or small file size), avoiding unnecessary resource consumption.
   */
  async downloadAttachmentSmart(
    messageId: string, 
    attachment: Attachment
  ): Promise<string> {
    const MAX_AUTO_DOWNLOAD_SIZE = 10 * 1024 * 1024; // 10MB limit for auto download
    
    // If it's already downloaded, return local path
    if (attachment.local_path && attachment.download_status === "downloaded") {
      return attachment.local_path;
    }

    // Smart download policy
    if (attachment.size && attachment.size > MAX_AUTO_DOWNLOAD_SIZE) {
      console.log(`[SmartDownload] Attachment size (${attachment.size} bytes) exceeds auto-download limit. User must click to download.`);
      return attachment.remote_url; // Return remote URL as placeholder
    }

    try {
      console.log(`[SmartDownload] Auto-downloading attachment of type ${attachment.type} (${attachment.size ?? 0} bytes)`);
      const localUri = await cacheMediaFile(attachment.remote_url, messageId);
      return localUri;
    } catch (err) {
      console.error("[SmartDownload] Download failed:", err);
      return attachment.remote_url;
    }
  }

  /**
   * Creates a ZIP-ready JSON backup bundle of the local SQLite database and references
   * to cached files.
   */
  async exportLocalBackup(): Promise<{ dbDump: string; mediaCount: number }> {
    const chats = await getChatsFromLocal();
    const backupData: Record<string, any> = {
      exportedAt: new Date().toISOString(),
      chats: chats,
      messages: []
    };

    let mediaCount = 0;
    for (const chat of chats) {
      const msgs = await getMessagesFromLocal(chat.id);
      backupData.messages.push(...msgs);
      for (const m of msgs) {
        if (m.attachments && m.attachments.length > 0) {
          mediaCount += m.attachments.filter(a => a.local_path).length;
        } else if (m.local_file_path) {
          mediaCount++;
        }
      }
    }

    return {
      dbDump: JSON.stringify(backupData, null, 2),
      mediaCount
    };
  }
}

export const chatRepository = new ChatRepository();
