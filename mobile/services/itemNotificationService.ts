import * as Notifications from "expo-notifications";
import { ReminderItem, EventItem } from "@/types/item";

/**
 * Agenda uma notificação local para um Lembrete ou Evento.
 * Retorna o ID da notificação agendada.
 */
export async function scheduleItemNotification(
  item: ReminderItem | EventItem
): Promise<string | null> {
  try {
    const targetDateStr = item.type === "reminder" ? item.dueDate : item.start;
    if (!targetDateStr) return null;

    const targetDate = new Date(targetDateStr);
    const now = new Date();

    // Não agenda para datas no passado
    if (targetDate.getTime() <= now.getTime()) {
      return null;
    }

    const title = item.type === "reminder" ? `⏰ Lembrete: ${item.title}` : `📅 Evento: ${item.title}`;
    const body = item.content || (item.type === "event" && item.location ? `Local: ${item.location}` : "Toque para abrir");

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { itemId: item.id, itemType: item.type },
        sound: true,
      },
      trigger: {
        date: targetDate,
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    });

    return identifier;
  } catch (error) {
    console.error("Erro ao agendar notificação de item:", error);
    return null;
  }
}

/**
 * Cancela uma notificação agendada por ID
 */
export async function cancelItemNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error("Erro ao cancelar notificação:", error);
  }
}
