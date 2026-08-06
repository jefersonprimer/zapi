import { API_URL, authFetch } from "./api";

export interface PlacedSticker {
  id: string;
  message_id: string;
  user_id: string;
  sticker_url: string;
  x_offset: number;
  y_offset: number;
  scale_factor: number;
  rotation: number;
  created_at: string;
}

/**
 * Place a sticker onto a specific message (Drag and drop).
 */
export async function placeStickerOnMessage(
  token: string,
  chatId: string,
  messageId: string,
  stickerUrl: string,
  xOffset: number,
  yOffset: number,
  scale: number = 1.0,
  rotation: number = 0.0
): Promise<PlacedSticker> {
  const response = await fetch(`${API_URL}/chats/${chatId}/messages/${messageId}/stickers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sticker_url: stickerUrl,
      x_offset: xOffset,
      y_offset: yOffset,
      scale_factor: scale,
      rotation: rotation,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to place sticker: ${errText}`);
  }

  return response.json();
}

/**
 * Remove a placed sticker from a message.
 */
export async function removePlacedSticker(
  token: string,
  chatId: string,
  messageId: string,
  stickerId: string
): Promise<void> {
  const response = await fetch(
    `${API_URL}/chats/${chatId}/messages/${messageId}/stickers/${stickerId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to remove sticker: ${errText}`);
  }
}
