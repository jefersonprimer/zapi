import * as Calendar from "expo-calendar";
import { EventItem } from "@/types/item";

/**
 * Solicita permissões de leitura/escrita do calendário do dispositivo
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

/**
 * Obtém ou cria um calendário dedicado do Superapp no dispositivo
 */
async function getOrCreateAppCalendar(): Promise<string | null> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return null;

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing = calendars.find((c) => c.title === "Superapp Events");
  if (existing) return existing.id;

  const defaultCalendarSource =
    calendars.find((c) => c.isPrimary || c.source.name === "Default")?.source ||
    calendars[0]?.source;

  if (!defaultCalendarSource) return null;

  const newCalendarId = await Calendar.createCalendarAsync({
    title: "Superapp Events",
    color: "#6366F1",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultCalendarSource.id,
    source: defaultCalendarSource,
    name: "superapp_events",
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return newCalendarId;
}

/**
 * Exporta um EventItem para o calendário nativo do dispositivo
 */
export async function syncEventToDeviceCalendar(
  eventItem: EventItem
): Promise<string | null> {
  try {
    const calendarId = await getOrCreateAppCalendar();
    if (!calendarId) return null;

    const startDate = new Date(eventItem.start);
    const endDate = new Date(eventItem.end);

    const deviceEventId = await Calendar.createEventAsync(calendarId, {
      title: eventItem.title,
      notes: eventItem.content,
      startDate,
      endDate,
      allDay: eventItem.allDay,
      location: eventItem.location,
    });

    return deviceEventId;
  } catch (error) {
    console.error("Erro ao sincronizar evento com calendário nativo:", error);
    return null;
  }
}

/**
 * Remove um evento sincronizado do calendário nativo do dispositivo
 */
export async function removeEventFromDeviceCalendar(
  deviceEventId: string
): Promise<void> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return;
    await Calendar.deleteEventAsync(deviceEventId);
  } catch (error) {
    console.error("Erro ao remover evento do calendário nativo:", error);
  }
}
