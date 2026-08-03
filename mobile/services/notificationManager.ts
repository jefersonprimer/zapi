import { Platform } from "react-native";
import { notifications as Notifications } from "./notifications";

interface ChatNotificationState {
  chatId: string;
  senderName: string;
  senderAvatarUrl?: string;
  unreadCount: number;
  messages: { content: string; timestamp: number }[];
  lastMessage: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  isGroup: boolean;
  groupName?: string;
}

/** Debounce window to aggregate rapid-fire messages into one notification */
const DEBOUNCE_MS = 800;
/** Max messages to keep in preview for multi-line notification body */
const MAX_PREVIEW_MESSAGES = 5;

/**
 * NotificationManager – WhatsApp-style notification aggregation.
 *
 * Strategy:
 * - 1 conversa = 1 notificação (sempre atualizada, nunca duplicada)
 * - Várias mensagens do mesmo contato → atualiza a mesma notificação
 * - Ao abrir a conversa → notificação correspondente é removida
 * - Debounce de 800ms agrupa mensagens em sequência rápida
 * - Se o usuário está vendo a conversa → nenhuma notificação é exibida
 */
class NotificationManager {
  private chatStates = new Map<string, ChatNotificationState>();
  private activeChatId: string | null = null;

  // ──────────────────────────────────────────────────────
  // Active Chat Tracking
  // ──────────────────────────────────────────────────────

  /**
   * Set which chat is currently open/active.
   * When a chat is active, no notification is shown for it and
   * any existing notification for that chat is dismissed.
   */
  setActiveChat(chatId: string | null) {
    this.activeChatId = chatId;
    if (chatId) {
      this.dismissChat(chatId);
    }
  }

  getActiveChat(): string | null {
    return this.activeChatId;
  }

  // ──────────────────────────────────────────────────────
  // Incoming Message Handling
  // ──────────────────────────────────────────────────────

  /**
   * Called when a new message arrives (via WebSocket `new_message_notification`).
   * Uses debouncing to aggregate rapid-fire messages into a single notification.
   */
  handleIncomingMessage(params: {
    chatId: string;
    senderName: string;
    senderAvatarUrl?: string;
    content: string;
    isGroup: boolean;
    groupName?: string;
  }) {
    // Don't notify if user is currently viewing this chat
    if (this.activeChatId === params.chatId) {
      return;
    }

    const existing = this.chatStates.get(params.chatId);

    if (existing) {
      // ── Update existing state ──
      existing.unreadCount++;
      existing.lastMessage = params.content;
      existing.senderName = params.senderName;
      if (params.senderAvatarUrl) {
        existing.senderAvatarUrl = params.senderAvatarUrl;
      }
      existing.messages.push({
        content: params.content,
        timestamp: Date.now(),
      });
      // Keep only last N messages for preview
      if (existing.messages.length > MAX_PREVIEW_MESSAGES) {
        existing.messages = existing.messages.slice(-MAX_PREVIEW_MESSAGES);
      }

      // Debounce: clear existing timer and set a new one
      if (existing.debounceTimer) {
        clearTimeout(existing.debounceTimer);
      }
      existing.debounceTimer = setTimeout(() => {
        this.fireNotification(params.chatId);
      }, DEBOUNCE_MS);
    } else {
      // ── First message from this chat ──
      const state: ChatNotificationState = {
        chatId: params.chatId,
        senderName: params.senderName,
        senderAvatarUrl: params.senderAvatarUrl,
        unreadCount: 1,
        messages: [{ content: params.content, timestamp: Date.now() }],
        lastMessage: params.content,
        debounceTimer: null,
        isGroup: params.isGroup,
        groupName: params.groupName,
      };
      this.chatStates.set(params.chatId, state);

      // First message: show immediately (no debounce)
      this.fireNotification(params.chatId);
    }
  }

  // ──────────────────────────────────────────────────────
  // Notification Firing
  // ──────────────────────────────────────────────────────

  /**
   * Show or update the notification for a given chat.
   * Uses chatId as the notification identifier so updates replace the old one.
   */
  private async fireNotification(chatId: string) {
    if (!Notifications) return;

    const state = this.chatStates.get(chatId);
    if (!state) return;

    // Clear debounce timer
    if (state.debounceTimer) {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = null;
    }

    // Double-check: don't show if chat became active during debounce
    if (this.activeChatId === chatId) {
      this.chatStates.delete(chatId);
      return;
    }

    // ── Build notification title ──
    const title =
      state.isGroup && state.groupName ? state.groupName : state.senderName;

    // ── Build notification body ──
    let body: string;
    if (state.unreadCount === 1) {
      // Single message: show content directly
      body = state.isGroup
        ? `${state.senderName}: ${state.lastMessage}`
        : state.lastMessage;
    } else {
      // Multiple messages: show count + last message preview
      const prefix = `${state.unreadCount} mensagens`;
      const lastPreview = state.isGroup
        ? `${state.senderName}: ${state.lastMessage}`
        : state.lastMessage;
      body = `${prefix}\n${lastPreview}`;
    }

    try {
      // Dismiss previous notification for this chat before posting updated one
      await Notifications.dismissNotificationAsync(chatId).catch(() => {});

      await Notifications.scheduleNotificationAsync({
        identifier: chatId, // Using chatId ensures 1 notification per conversation
        content: {
          title,
          body,
          data: { chatId, chat_id: chatId },
          sound: "default",
          priority: Notifications.AndroidNotificationPriority?.HIGH ?? "high",
          sticky: false,
          ...(Platform.OS === "ios" && state.senderAvatarUrl
            ? {
                attachments: [
                  {
                    identifier: "sender-avatar",
                    url: state.senderAvatarUrl,
                  },
                ],
              }
            : {}),
          ...(Platform.OS === "android" && {
            channelId: "messages",
          }),
          ...(Platform.OS === "ios" && {
            categoryIdentifier: "message",
            _contentAvailable: true,
          }),
          badge: this.getTotalUnreadCount(),
        },
        trigger: null, // Show immediately
      });
    } catch (err) {
      console.warn("NotificationManager: failed to fire notification:", err);
    }
  }

  // ──────────────────────────────────────────────────────
  // Dismissal
  // ──────────────────────────────────────────────────────

  /**
   * Dismiss all notifications for a specific chat
   * (e.g., when the user opens that conversation).
   */
  async dismissChat(chatId: string) {
    const state = this.chatStates.get(chatId);
    if (state?.debounceTimer) {
      clearTimeout(state.debounceTimer);
    }
    this.chatStates.delete(chatId);

    if (Notifications) {
      try {
        await Notifications.dismissNotificationAsync(chatId);
      } catch {}
    }

    // Update badge count
    this.updateBadge();
  }

  /**
   * Dismiss ALL notifications (e.g., on logout or full reset).
   */
  async dismissAll() {
    for (const [, state] of this.chatStates) {
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
    }
    this.chatStates.clear();

    if (Notifications) {
      try {
        await Notifications.dismissAllNotificationsAsync();
        await Notifications.setBadgeCountAsync(0);
      } catch {}
    }
  }

  // ──────────────────────────────────────────────────────
  // Badge
  // ──────────────────────────────────────────────────────

  /** Get total unread count across all chats with pending notifications. */
  getTotalUnreadCount(): number {
    let total = 0;
    for (const [, state] of this.chatStates) {
      total += state.unreadCount;
    }
    return total;
  }

  /** Update badge count on the app icon. */
  private async updateBadge() {
    if (Notifications) {
      try {
        await Notifications.setBadgeCountAsync(this.getTotalUnreadCount());
      } catch {}
    }
  }
}

export const notificationManager = new NotificationManager();
