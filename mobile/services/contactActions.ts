import { blockContact, unblockContact } from "./api";
import { setChatBlockedLocal } from "./database";

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
