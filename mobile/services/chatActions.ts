import { blockContact, unblockContact, favoriteChat, muteChat, clearChatMessages, updateChatLists } from "./api";
import { setChatBlockedLocal, setChatFavoriteLocal, setChatMuteLocal, clearChatMessagesLocal, getDatabase } from "./database";

/**
 * Helper function to toggle the block status of a contact.
 * It coordinates the API call to the server and updates the local SQLite database.
 * 
 * @param token The user auth token.
 * @param participantId The contact's ID to block/unblock.
 * @param chatId The ID of the chat associated with the contact (if any).
 * @param block True to block, false to unblock.
 */
export async function toggleBlockContact(
  token: string,
  participantId: string,
  chatId: string | null | undefined,
  block: boolean
): Promise<{ status: string; is_blocked: boolean }> {
  let response;
  if (block) {
    response = await blockContact(token, participantId);
  } else {
    response = await unblockContact(token, participantId);
  }
  
  if (chatId) {
    await setChatBlockedLocal(chatId, block);
  }
  
  return response;
}

/**
 * Helper function to toggle the favorite status of a chat.
 * It coordinates the API call to the server and updates the local SQLite database.
 * 
 * @param token The user auth token.
 * @param chatId The ID of the chat to favorite/unfavorite.
 * @param isFavorite True to favorite, false to unfavorite.
 */
export async function toggleFavoriteChat(
  token: string,
  chatId: string,
  isFavorite: boolean
): Promise<{ status: string; chat_id: string; is_favorite: boolean }> {
  await setChatFavoriteLocal(chatId, isFavorite);
  return await favoriteChat(token, chatId, isFavorite);
}

/**
 * Helper function to toggle the mute status of a chat.
 * It coordinates the API call to the server and updates the local SQLite database.
 * 
 * @param token The user auth token.
 * @param chatId The ID of the chat to mute/unmute.
 * @param durationHours The duration in hours, "always" to mute forever, or "unmute" to unmute.
 */
export async function toggleMuteChat(
  token: string,
  chatId: string,
  durationHours: number | "always" | "unmute"
): Promise<{ mutedUntil: string | null; mutedForever: boolean }> {
  let mutedUntil: string | null = null;
  let mutedForever = false;

  if (durationHours === "always") {
    mutedForever = true;
  } else if (durationHours === "unmute") {
    mutedForever = false;
    mutedUntil = null;
  } else {
    mutedUntil = new Date(
      Date.now() + durationHours * 60 * 60 * 1000
    ).toISOString();
  }

  await muteChat(token, chatId, mutedUntil, mutedForever);
  await setChatMuteLocal(chatId, mutedUntil, mutedForever);

  return { mutedUntil, mutedForever };
}

/**
 * Helper function to clear the message history of a chat.
 * It coordinates the API call to the server and updates the local SQLite database.
 * 
 * @param token The user auth token.
 * @param chatId The ID of the chat to clear.
 */
export async function clearChatHistory(
  token: string,
  chatId: string
): Promise<{ status: string; chat_id: string }> {
  const response = await clearChatMessages(token, chatId);
  await clearChatMessagesLocal(chatId);
  return response;
}

/**
 * Helper function to update the chat lists a specific chat belongs to.
 * It coordinates the API call to the server and updates the local SQLite database.
 * 
 * @param token The user auth token.
 * @param chatId The ID of the chat.
 * @param selectedListIds The IDs of the lists the chat should belong to.
 */
export async function updateChatListSelections(
  token: string,
  chatId: string,
  selectedListIds: string[]
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "DELETE FROM chat_list_items WHERE chat_id = ? AND list_id IN (SELECT id FROM chat_lists)",
    [chatId]
  );
  for (const lid of selectedListIds) {
    await db.runAsync(
      "INSERT INTO chat_list_items (list_id, chat_id, created_at) VALUES (?, ?, ?)",
      [lid, chatId, new Date().toISOString()]
    );
  }

  await updateChatLists(token, chatId, selectedListIds);
}
