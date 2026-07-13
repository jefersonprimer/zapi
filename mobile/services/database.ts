import * as SQLite from "expo-sqlite";
import { ChatListItem, Message, Attachment } from "./api";

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
      is_group INTEGER DEFAULT 0,
      name TEXT,
      last_message TEXT,
      last_message_at TEXT,
      created_at TEXT,
      unread_count INTEGER DEFAULT 0,
      is_blocked_by_me INTEGER DEFAULT 0,
      is_blocked_by_them INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0
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
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
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
        id, participant_id, participant_username, participant_avatar_url, is_group, name, 
        last_message, last_message_at, created_at, unread_count, 
        is_blocked_by_me, is_blocked_by_them, notification_muted_until, notification_muted_forever,
        is_archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        participant_id=excluded.participant_id,
        participant_username=excluded.participant_username,
        participant_avatar_url=excluded.participant_avatar_url,
        is_group=excluded.is_group,
        name=excluded.name,
        last_message=excluded.last_message,
        last_message_at=excluded.last_message_at,
        created_at=excluded.created_at,
        unread_count=excluded.unread_count,
        is_blocked_by_me=excluded.is_blocked_by_me,
        is_blocked_by_them=excluded.is_blocked_by_them,
        notification_muted_until=excluded.notification_muted_until,
        notification_muted_forever=excluded.notification_muted_forever,
        is_archived=excluded.is_archived`,
      [
        chat.id,
        chat.participant_id || null,
        chat.participant_username || null,
        chat.participant_avatar_url || null,
        chat.is_group ? 1 : 0,
        chat.name || null,
        chat.last_message || null,
        chat.last_message_at || null,
        chat.created_at,
        chat.unread_count || 0,
        chat.is_blocked_by_me ? 1 : 0,
        chat.is_blocked_by_them ? 1 : 0,
        chat.notification_muted_until || null,
        chat.notification_muted_forever ? 1 : 0,
        chat.is_archived ? 1 : 0,
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
    is_group: r.is_group === 1,
    name: r.name,
    last_message: r.last_message,
    last_message_at: r.last_message_at,
    created_at: r.created_at,
    unread_count: r.unread_count,
    is_blocked_by_me: r.is_blocked_by_me === 1,
    is_blocked_by_them: r.is_blocked_by_them === 1,
    is_pinned: r.is_pinned === 1,
    notification_muted_until: r.notification_muted_until,
    notification_muted_forever: r.notification_muted_forever === 1,
    is_archived: r.is_archived === 1,
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
  for (const r of sortedRows) {
    // Fetch corresponding attachments
    const attRows = await db.getAllAsync<any>(
      "SELECT * FROM attachments WHERE message_id = ?",
      [r.id]
    );

    const attachments: Attachment[] = attRows.map((a) => ({
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
  status?: "pending" | "uploading" | "uploaded" | "sending" | "sent" | "delivered" | "read" | "failed";
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
  let lastMsg = msg.content || "";
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
  status: "pending" | "uploading" | "uploaded" | "sending" | "sent" | "delivered" | "read" | "failed",
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
      // Normal update changing the local ID to the server ID
      await db.runAsync(
        `UPDATE messages SET
          id = ?,
          status = ?,
          image_url = COALESCE(?, image_url),
          local_file_path = COALESCE(?, local_file_path)
         WHERE id = ?`,
        [
          updates.serverId,
          status,
          updates.image_url || null,
          updates.local_file_path || null,
          id,
        ]
      );
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
