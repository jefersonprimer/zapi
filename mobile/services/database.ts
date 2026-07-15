import * as SQLite from "expo-sqlite";
import { ChatListItem, Message, Attachment } from "./api";
import { resolveLastMessagePreview } from "@/utils/forwardMessage";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("messages.db");
  }
  return dbInstance;
}

export async function initializeDatabase() {
  const db = await getDatabase();
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      participant_id TEXT,
      participant_username TEXT,
      participant_avatar_url TEXT,
      participant_name TEXT,
      is_group INTEGER DEFAULT 0,
      name TEXT,
      avatar_url TEXT,
      description TEXT,
      last_message TEXT,
      last_message_at TEXT,
      created_at TEXT,
      unread_count INTEGER DEFAULT 0,
      is_blocked_by_me INTEGER DEFAULT 0,
      is_blocked_by_them INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0
    );
  `);

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN participant_name TEXT;");
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN avatar_url TEXT;");
  } catch (e) {
    // Ignore error if column already exists
  }
  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN description TEXT;");
  } catch (e) {
    // Ignore error if column already exists
  }

  await db.execAsync(`

    CREATE TABLE IF NOT EXISTS chat_lists (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      color TEXT,
      icon TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_list_items (
      list_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (list_id, chat_id),
      FOREIGN KEY (list_id) REFERENCES chat_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_list_order (
      list_id TEXT PRIMARY KEY,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_username TEXT NOT NULL,
      content TEXT,
      image_url TEXT,
      local_file_path TEXT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent', -- 'pending', 'uploading', 'uploaded', 'sending', 'sent', 'delivered', 'read', 'failed'
      deleted_for_everyone INTEGER DEFAULT 0,
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE ON UPDATE CASCADE,
      type TEXT NOT NULL, -- 'image', 'video', 'audio', 'document'
      remote_url TEXT NOT NULL,
      local_path TEXT,
      mime_type TEXT,
      width INTEGER,
      height INTEGER,
      duration INTEGER,
      size INTEGER,
      sha256 TEXT,
      thumbnail_path TEXT,
      download_status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'downloading', 'downloaded', 'failed'
    );

    -- Indices for message lookup optimization
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON messages(chat_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
    CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

     -- Indices for attachments lookup optimization
    CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_download_status ON attachments(download_status);
  `);

  try {
    await db.execAsync("ALTER TABLE messages ADD COLUMN deleted_at TEXT DEFAULT NULL;");
  } catch (_) {
    // Column already exists
  }

  // Migration logic to ensure existing tables get the new column
  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN participant_avatar_url TEXT;");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN is_pinned INTEGER DEFAULT 0;");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN is_favorite INTEGER DEFAULT 0;");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN notification_muted_until TEXT DEFAULT NULL;");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN notification_muted_forever INTEGER DEFAULT 0;");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN is_archived INTEGER DEFAULT 0;");
  } catch (err) {
    // Ignore error if column already exists
  }

  try {
    await db.execAsync("ALTER TABLE chats ADD COLUMN messages_restricted_reason TEXT DEFAULT NULL;");
  } catch (err) {
    // Ignore error if column already exists
  }
}

// Bulk save chats fetched from server
export async function saveChats(chats: ChatListItem[]) {
  const db = await getDatabase();

  // Delete local chats and messages that are no longer on the server
  const serverChatIds = chats.map((c) => c.id);
  if (serverChatIds.length > 0) {
    const placeholders = serverChatIds.map(() => "?").join(",");
    await db.runAsync(
      `DELETE FROM messages WHERE chat_id NOT IN (${placeholders})`,
      serverChatIds
    );
    await db.runAsync(
      `DELETE FROM chats WHERE id NOT IN (${placeholders})`,
      serverChatIds
    );
  } else {
    await db.runAsync("DELETE FROM messages");
    await db.runAsync("DELETE FROM chats");
  }

  for (const chat of chats) {
    await db.runAsync(
      `INSERT INTO chats (
        id, participant_id, participant_username, participant_avatar_url, participant_name, is_group, name, 
        avatar_url, description,
        last_message, last_message_at, created_at, unread_count, 
        is_blocked_by_me, is_blocked_by_them, messages_restricted_reason,
        notification_muted_until, notification_muted_forever,
        is_archived, is_favorite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        participant_id=excluded.participant_id,
        participant_username=excluded.participant_username,
        participant_avatar_url=excluded.participant_avatar_url,
        participant_name=excluded.participant_name,
        is_group=excluded.is_group,
        name=excluded.name,
        avatar_url=excluded.avatar_url,
        description=excluded.description,
        last_message=excluded.last_message,
        last_message_at=excluded.last_message_at,
        created_at=excluded.created_at,
        unread_count=excluded.unread_count,
        is_blocked_by_me=excluded.is_blocked_by_me,
        is_blocked_by_them=excluded.is_blocked_by_them,
        messages_restricted_reason=excluded.messages_restricted_reason,
        notification_muted_until=excluded.notification_muted_until,
        notification_muted_forever=excluded.notification_muted_forever,
        is_archived=excluded.is_archived,
        is_favorite=excluded.is_favorite`,
      [
        chat.id,
        chat.participant_id || null,
        chat.participant_username || null,
        chat.participant_avatar_url || null,
        chat.participant_name || null,
        chat.is_group ? 1 : 0,
        chat.name || null,
        chat.avatar_url || null,
        chat.description || null,
        resolveLastMessagePreview(chat.last_message) || null,
        chat.last_message_at || null,
        chat.created_at,
        chat.unread_count || 0,
        chat.is_blocked_by_me ? 1 : 0,
        chat.is_blocked_by_them ? 1 : 0,
        chat.messages_restricted_reason || null,
        chat.notification_muted_until || null,
        chat.notification_muted_forever ? 1 : 0,
        chat.is_archived ? 1 : 0,
        chat.is_favorite ? 1 : 0,
      ]
    );
  }
}

// Bulk save messages fetched from server
export async function saveMessages(messages: Message[]) {
  const db = await getDatabase();
  for (const msg of messages) {
    await db.runAsync(
      `INSERT INTO messages (
        id, chat_id, sender_id, sender_username, content, image_url, local_file_path, created_at, status, deleted_for_everyone, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        image_url = excluded.image_url,
        local_file_path = COALESCE(excluded.local_file_path, local_file_path),
        created_at = excluded.created_at,
        deleted_for_everyone = excluded.deleted_for_everyone,
        deleted_at = excluded.deleted_at`,
      [
        msg.id,
        msg.chat_id,
        msg.sender_id,
        msg.sender_username,
        msg.content || null,
        msg.image_url || null,
        msg.local_file_path || null,
        msg.created_at,
        msg.status || "sent",
        msg.deleted_for_everyone ? 1 : 0,
        msg.deleted_at || null,
      ]
    );

    // Save attachments if they are present in the message payload
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        await db.runAsync(
          `INSERT INTO attachments (
            id, message_id, type, remote_url, local_path, mime_type, 
            width, height, duration, size, sha256, thumbnail_path, download_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            message_id = excluded.message_id,
            remote_url = excluded.remote_url,
            local_path = COALESCE(excluded.local_path, local_path),
            download_status = COALESCE(excluded.download_status, download_status)`,
          [
            att.id,
            att.message_id,
            att.type,
            att.remote_url,
            att.local_path || null,
            att.mime_type || null,
            att.width || null,
            att.height || null,
            att.duration || null,
            att.size || null,
            att.sha256 || null,
            att.thumbnail_path || null,
            att.download_status || "pending",
          ]
        );
      }
    }
  }
}

export async function getChatsFromLocal(): Promise<ChatListItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM chats ORDER BY is_pinned DESC, last_message_at DESC, created_at DESC"
  );
  return rows.map((r) => ({
    id: r.id,
    participant_id: r.participant_id,
    participant_username: r.participant_username,
    participant_avatar_url: r.participant_avatar_url,
    participant_name: r.participant_name,
    is_group: r.is_group === 1,
    name: r.name,
    avatar_url: r.avatar_url,
    description: r.description,
    last_message: r.last_message,
    last_message_at: r.last_message_at,
    created_at: r.created_at,
    unread_count: r.unread_count,
    is_blocked_by_me: r.is_blocked_by_me === 1,
    is_blocked_by_them: r.is_blocked_by_them === 1,
    messages_restricted_reason: r.messages_restricted_reason || null,
    is_pinned: r.is_pinned === 1,
    notification_muted_until: r.notification_muted_until,
    notification_muted_forever: r.notification_muted_forever === 1,
    is_archived: r.is_archived === 1,
    is_favorite: r.is_favorite === 1,
  }));
}

export async function setChatMuteLocal(
  chatId: string,
  mutedUntil: string | null,
  mutedForever: boolean
) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE chats SET notification_muted_until = ?, notification_muted_forever = ? WHERE id = ?",
    [mutedUntil, mutedForever ? 1 : 0, chatId]
  );
}

export async function getMessagesFromLocal(
  chatId: string,
  limit?: number,
  offset?: number
): Promise<Message[]> {
  const db = await getDatabase();
  let query = "SELECT * FROM messages WHERE chat_id = ? AND deleted_at IS NULL ORDER BY created_at ASC";
  const params: any[] = [chatId];

  if (limit !== undefined) {
    // If paginating, sort descending to get the newest messages first
    query = "SELECT * FROM messages WHERE chat_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?";
    params.push(limit);
    if (offset !== undefined) {
      query += " OFFSET ?";
      params.push(offset);
    }
  }

  const rows = await db.getAllAsync<any>(query, params);
  
  // Reverse the results if we used pagination (so that they are returned in chronological order to the UI)
  const sortedRows = limit !== undefined ? rows.reverse() : rows;

  const messages: Message[] = [];
  
  // Batch fetch all attachments for the sorted messages to avoid SQLite finalizeAsync errors in loops
  const messageIds = sortedRows.map((r) => r.id);
  const attachmentsByMsgId: Record<string, Attachment[]> = {};
  
  if (messageIds.length > 0) {
    const placeholders = messageIds.map(() => "?").join(",");
    try {
      const attRows = await db.getAllAsync<any>(
        `SELECT * FROM attachments WHERE message_id IN (${placeholders})`,
        messageIds
      );
      for (const a of attRows) {
        if (!attachmentsByMsgId[a.message_id]) {
          attachmentsByMsgId[a.message_id] = [];
        }
        attachmentsByMsgId[a.message_id].push({
          id: a.id,
          message_id: a.message_id,
          type: a.type,
          remote_url: a.remote_url,
          local_path: a.local_path,
          mime_type: a.mime_type,
          width: a.width,
          height: a.height,
          duration: a.duration,
          size: a.size,
          sha256: a.sha256,
          thumbnail_path: a.thumbnail_path,
          download_status: a.download_status,
        });
      }
    } catch (err) {
      console.warn("Failed to fetch attachments for messages:", err);
    }
  }

  for (const r of sortedRows) {
    const attachments = attachmentsByMsgId[r.id] || [];
    const firstAttachment = attachments[0] || null;

    messages.push({
      id: r.id,
      chat_id: r.chat_id,
      sender_id: r.sender_id,
      sender_username: r.sender_username,
      content: r.content,
      // Fallback/compatibility values
      image_url: firstAttachment ? firstAttachment.remote_url : r.image_url,
      local_file_path: firstAttachment ? firstAttachment.local_path : r.local_file_path,
      created_at: r.created_at,
      status: r.status,
      deleted_for_everyone: r.deleted_for_everyone === 1,
      deleted_at: r.deleted_at || null,
      attachments,
    });
  }

  return messages;
}

export async function insertMessageLocal(msg: {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_username: string;
  content: string | null;
  image_url: string | null;
  local_file_path?: string | null;
  created_at: string;
  status?: "pending" | "uploading" | "uploaded" | "sending" | "sent" | "delivered" | "read" | "failed" | "privacy_messages_nobody" | "privacy_messages_contacts" | "chat_blocked";
  attachments?: Attachment[];
}) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO messages (
      id, chat_id, sender_id, sender_username, content, image_url, local_file_path, created_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.chat_id,
      msg.sender_id,
      msg.sender_username,
      msg.content,
      msg.image_url || null,
      msg.local_file_path || null,
      msg.created_at,
      msg.status || "sent",
    ]
  );

  // Save attachments locally if provided
  if (msg.attachments && msg.attachments.length > 0) {
    for (const att of msg.attachments) {
      await db.runAsync(
        `INSERT INTO attachments (
          id, message_id, type, remote_url, local_path, mime_type, 
          width, height, duration, size, sha256, thumbnail_path, download_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          att.id,
          att.message_id,
          att.type,
          att.remote_url,
          att.local_path || null,
          att.mime_type || null,
          att.width || null,
          att.height || null,
          att.duration || null,
          att.size || null,
          att.sha256 || null,
          att.thumbnail_path || null,
          att.download_status || "pending",
        ]
      );
    }
  }

  // Update chat last message
  let lastMsg = resolveLastMessagePreview(msg.content || "");
  if (lastMsg) {
    try {
      const parsed = JSON.parse(lastMsg);
      if (parsed?.type === "contact_share") {
        lastMsg = `👤 Contato: ${parsed.username || ""}`;
      }
    } catch {
      // plain text / already resolved forward preview
    }
  }
  if (!lastMsg && (msg.local_file_path || msg.image_url || (msg.attachments && msg.attachments.length > 0))) {
    const url = msg.image_url || msg.local_file_path || (msg.attachments && msg.attachments[0]?.remote_url) || "";
    if (url.includes("images") || url.includes("photo") || (msg.attachments && msg.attachments[0]?.type === "image")) {
      lastMsg = "📷 Foto";
    } else if (url.includes("audio") || url.includes("sound") || (msg.attachments && msg.attachments[0]?.type === "audio")) {
      lastMsg = "🎵 Áudio";
    } else if (url.includes("videos") || url.includes("video") || (msg.attachments && msg.attachments[0]?.type === "video")) {
      lastMsg = "🎥 Vídeo";
    } else {
      const fileName = url.split("/").pop() || "Arquivo";
      const match = fileName.match(/^[^_]+_[0-9a-fA-F\-]{36}_(.+)$/);
      const cleanName = match ? match[1] : fileName;
      lastMsg = `File|${cleanName}`;
    }
  }
  await db.runAsync(
    `UPDATE chats SET last_message = ?, last_message_at = ? WHERE id = ?`,
    [lastMsg, msg.created_at, msg.chat_id]
  );
}

export async function updateMessageStatusLocal(
  id: string,
  status: "pending" | "uploading" | "uploaded" | "sending" | "sent" | "delivered" | "read" | "failed" | "privacy_messages_nobody" | "privacy_messages_contacts" | "chat_blocked",
  updates?: {
    serverId?: string;
    image_url?: string | null;
    local_file_path?: string | null;
    attachments?: Attachment[];
  }
) {
  const db = await getDatabase();
  
  // Update messages
  if (updates?.serverId && updates.serverId !== id) {
    // Check if the message with the server ID already exists (e.g., inserted by websocket first)
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM messages WHERE id = ?",
      [updates.serverId]
    );

    if (existing) {
      // 1. Update the existing message with any local-only metadata (e.g. local_file_path) and status
      await db.runAsync(
        `UPDATE messages SET
          status = ?,
          local_file_path = COALESCE(?, local_file_path)
         WHERE id = ?`,
        [
          status,
          updates.local_file_path || null,
          updates.serverId
        ]
      );

      // 2. Point any attachments referencing the local ID to the server ID
      await db.runAsync(
        "UPDATE attachments SET message_id = ? WHERE message_id = ?",
        [updates.serverId, id]
      );

      // 3. Delete the temporary message (it has been replaced by the server message)
      await db.runAsync("DELETE FROM messages WHERE id = ?", [id]);
    } else {
      // Normal update changing the local ID to the server ID.
      // Since SQLite lacks ON UPDATE CASCADE on some existing schemas, we do this in three steps:
      // 1. Fetch the existing local message details
      const localMsg = await db.getFirstAsync<any>(
        "SELECT * FROM messages WHERE id = ?",
        [id]
      );
      if (localMsg) {
        // 2. Insert the message with the new server ID
        await db.runAsync(
          `INSERT OR REPLACE INTO messages (
            id, chat_id, sender_id, sender_username, content, image_url, local_file_path, created_at, status, deleted_for_everyone, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            updates.serverId,
            localMsg.chat_id,
            localMsg.sender_id,
            localMsg.sender_username,
            localMsg.content,
            updates.image_url !== undefined ? (updates.image_url || null) : (localMsg.image_url || null),
            updates.local_file_path !== undefined ? (updates.local_file_path || null) : (localMsg.local_file_path || null),
            localMsg.created_at,
            status,
            localMsg.deleted_for_everyone || 0,
            localMsg.deleted_at || null
          ]
        );

        // 3. Point attachments to the server ID
        await db.runAsync(
          "UPDATE attachments SET message_id = ? WHERE message_id = ?",
          [updates.serverId, id]
        );

        // 4. Delete the temporary message
        await db.runAsync("DELETE FROM messages WHERE id = ?", [id]);
      }
    }
  } else {
    await db.runAsync(
      `UPDATE messages SET
        status = ?,
        image_url = COALESCE(?, image_url),
        local_file_path = COALESCE(?, local_file_path)
       WHERE id = ?`,
      [status, updates?.image_url || null, updates?.local_file_path || null, id]
    );
  }

  // Update attachments if they are included in the updates
  if (updates?.attachments && updates.attachments.length > 0) {
    const msgId = updates.serverId || id;
    for (const att of updates.attachments) {
      await db.runAsync(
        `INSERT INTO attachments (
          id, message_id, type, remote_url, local_path, mime_type, 
          width, height, duration, size, sha256, thumbnail_path, download_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          message_id = excluded.message_id,
          remote_url = excluded.remote_url,
          local_path = COALESCE(excluded.local_path, local_path),
          download_status = COALESCE(excluded.download_status, download_status)`,
        [
          att.id,
          msgId,
          att.type,
          att.remote_url,
          att.local_path || null,
          att.mime_type || null,
          att.width || null,
          att.height || null,
          att.duration || null,
          att.size || null,
          att.sha256 || null,
          att.thumbnail_path || null,
          att.download_status || "pending",
        ]
      );
    }
  }
}

export async function getAttachmentsForMessage(messageId: string): Promise<Attachment[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM attachments WHERE message_id = ?",
    [messageId]
  );
  return rows.map((a) => ({
    id: a.id,
    message_id: a.message_id,
    type: a.type,
    remote_url: a.remote_url,
    local_path: a.local_path,
    mime_type: a.mime_type,
    width: a.width,
    height: a.height,
    duration: a.duration,
    size: a.size,
    sha256: a.sha256,
    thumbnail_path: a.thumbnail_path,
    download_status: a.download_status,
  }));
}

export async function updateAttachmentLocalPath(
  attachmentId: string,
  localPath: string,
  downloadStatus: "pending" | "downloading" | "downloaded" | "failed" = "downloaded"
) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE attachments SET local_path = ?, download_status = ? WHERE id = ?",
    [localPath, downloadStatus, attachmentId]
  );
}

export async function markChatReadLocal(chatId: string) {
  const db = await getDatabase();
  await db.runAsync("UPDATE chats SET unread_count = 0 WHERE id = ?", [chatId]);
}

export async function markSentMessagesReadLocal(chatId: string, myUserId: string, readAtIso: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE messages SET status = 'read' WHERE chat_id = ? AND sender_id = ? AND created_at <= ?",
    [chatId, myUserId, readAtIso]
  );
}

export async function markSentMessagesDeliveredLocal(chatId: string, myUserId: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE messages SET status = 'delivered' WHERE chat_id = ? AND sender_id = ? AND status = 'sent'",
    [chatId, myUserId]
  );
}

export async function clearChatMessagesLocal(chatId: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM messages WHERE chat_id = ?", [chatId]);
  await db.runAsync(
    "UPDATE chats SET last_message = NULL, last_message_at = NULL WHERE id = ?",
    [chatId]
  );
}

export async function deleteChatLocal(chatId: string) {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM messages WHERE chat_id = ?", [chatId]);
  await db.runAsync("DELETE FROM chats WHERE id = ?", [chatId]);
}

export async function deleteMessageLocal(messageId: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE messages SET content = NULL, image_url = NULL, deleted_for_everyone = 1 WHERE id = ?",
    [messageId]
  );
}

export async function deleteMessageForMeLocal(messageId: string) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE messages SET deleted_at = ? WHERE id = ?",
    [new Date().toISOString(), messageId]
  );
}

export async function getPendingMessages(): Promise<any[]> {
  const db = await getDatabase();
  return db.getAllAsync<any>(
    "SELECT * FROM messages WHERE status = 'pending' OR status = 'uploading'"
  );
}

// Clear all local data on logout
export async function clearAllLocalData() {
  const db = await getDatabase();
  await db.execAsync("DELETE FROM messages;");
  await db.execAsync("DELETE FROM chats;");
}

export async function setChatPinnedLocal(chatId: string, isPinned: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE chats SET is_pinned = ? WHERE id = ?",
    [isPinned ? 1 : 0, chatId]
  );
}

export async function setChatArchivedLocal(chatId: string, isArchived: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE chats SET is_archived = ? WHERE id = ?",
    [isArchived ? 1 : 0, chatId]
  );
}

export async function setChatBlockedLocal(chatId: string, isBlocked: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE chats SET is_blocked_by_me = ? WHERE id = ?",
    [isBlocked ? 1 : 0, chatId]
  );
}

export async function setChatFavoriteLocal(chatId: string, isFavorite: boolean) {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE chats SET is_favorite = ? WHERE id = ?",
    [isFavorite ? 1 : 0, chatId]
  );
}

export interface LocalChatList {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  chat_ids: string[];
}

export async function saveLocalChatLists(lists: LocalChatList[]) {
  const db = await getDatabase();
  
  // Clean all local lists not in server response
  const listIds = lists.map((l) => l.id);
  if (listIds.length > 0) {
    const placeholders = listIds.map(() => "?").join(",");
    await db.runAsync(`DELETE FROM chat_list_items WHERE list_id NOT IN (${placeholders})`, listIds);
    await db.runAsync(`DELETE FROM chat_lists WHERE id NOT IN (${placeholders})`, listIds);
  } else {
    await db.runAsync("DELETE FROM chat_list_items");
    await db.runAsync("DELETE FROM chat_lists");
  }

  for (const list of lists) {
    await db.runAsync(
      `INSERT INTO chat_lists (id, user_id, name, color, icon, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         color = excluded.color,
         icon = excluded.icon,
         position = excluded.position,
         updated_at = excluded.updated_at`,
      [list.id, list.user_id, list.name, list.color, list.icon, list.position, list.created_at, list.updated_at]
    );

    // Save items
    await db.runAsync("DELETE FROM chat_list_items WHERE list_id = ?", [list.id]);
    for (const chatId of list.chat_ids) {
      // Check if chat exists locally before inserting to satisfy foreign key constraint
      const chatExists = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM chats WHERE id = ?",
        [chatId]
      );
      if (chatExists) {
        await db.runAsync(
          "INSERT INTO chat_list_items (list_id, chat_id, created_at) VALUES (?, ?, ?)",
          [list.id, chatId, new Date().toISOString()]
        );
      }
    }
  }
}

export async function getLocalChatLists(): Promise<LocalChatList[]> {
  const db = await getDatabase();
  const lists = await db.getAllAsync<any>(
    "SELECT * FROM chat_lists ORDER BY position ASC, created_at ASC"
  );
  
  const response: LocalChatList[] = [];
  for (const list of lists) {
    const items = await db.getAllAsync<{ chat_id: string }>(
      "SELECT chat_id FROM chat_list_items WHERE list_id = ?",
      [list.id]
    );
    response.push({
      id: list.id,
      user_id: list.user_id,
      name: list.name,
      color: list.color,
      icon: list.icon,
      position: list.position,
      created_at: list.created_at,
      updated_at: list.updated_at,
      chat_ids: items.map(i => i.chat_id),
    });
  }
  return response;
}

export async function getListPositionsLocal(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ list_id: string; position: number }>(
    "SELECT list_id, position FROM chat_list_order"
  );
  const positions: Record<string, number> = {};
  for (const row of rows) {
    positions[row.list_id] = row.position;
  }
  return positions;
}

export async function saveListPositionLocal(listId: string, position: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO chat_list_order (list_id, position) VALUES (?, ?) ON CONFLICT(list_id) DO UPDATE SET position = excluded.position",
    [listId, position]
  );
}

export async function updateLocalGroupDetails(
  chatId: string,
  name: string | null,
  avatarUrl: string | null,
  description: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE chats SET name = ?, avatar_url = ?, description = ? WHERE id = ?",
    [name, avatarUrl, description, chatId]
  );
}

