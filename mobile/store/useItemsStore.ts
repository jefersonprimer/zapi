import { create } from "zustand";
import {
  AnyItem,
  NoteItem,
  ReminderItem,
  EventItem,
  ItemType,
  CreateNoteInput,
  CreateReminderInput,
  CreateEventInput,
} from "@/types/item";
import { ItemRepository } from "@/services/ItemRepository";
import { scheduleItemNotification, cancelItemNotification } from "@/services/itemNotificationService";
import { syncEventToDeviceCalendar } from "@/services/deviceCalendarService";

interface ItemsState {
  items: AnyItem[];
  isLoading: boolean;
  filterType: ItemType | "all";
  syncWithDeviceCalendar: boolean;

  // Ações
  fetchItems: (type?: ItemType) => Promise<void>;
  setFilterType: (type: ItemType | "all") => void;
  setSyncWithDeviceCalendar: (sync: boolean) => void;

  createNote: (input: CreateNoteInput) => Promise<NoteItem>;
  createReminder: (input: CreateReminderInput) => Promise<ReminderItem>;
  createEvent: (input: CreateEventInput) => Promise<EventItem>;

  toggleReminderCompleted: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // Conversões
  convertNoteToReminder: (noteId: string, dueDate?: string) => Promise<ReminderItem | null>;
  convertReminderToEvent: (reminderId: string, startAt?: string, endAt?: string) => Promise<EventItem | null>;
  createNoteFromEvent: (eventId: string) => Promise<NoteItem | null>;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: [],
  isLoading: false,
  filterType: "all",
  syncWithDeviceCalendar: false,

  setFilterType: (filterType) => {
    set({ filterType });
    get().fetchItems(filterType === "all" ? undefined : filterType);
  },

  setSyncWithDeviceCalendar: (syncWithDeviceCalendar) => {
    set({ syncWithDeviceCalendar });
  },

  fetchItems: async (type) => {
    set({ isLoading: true });
    try {
      const items = await ItemRepository.getItems({ type });
      set({ items, isLoading: false });
    } catch (error) {
      console.error("Erro ao buscar items:", error);
      set({ isLoading: false });
    }
  },

  createNote: async (input) => {
    const note = await ItemRepository.createNote(input);
    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
    return note;
  },

  createReminder: async (input) => {
    const reminder = await ItemRepository.createReminder(input);

    // Agendar notificação se houver dueDate
    if (reminder.dueDate) {
      const notifId = await scheduleItemNotification(reminder);
      if (notifId) {
        reminder.notificationId = notifId;
      }
    }

    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
    return reminder;
  },

  createEvent: async (input) => {
    const event = await ItemRepository.createEvent(input);

    // Agendar notificação local
    await scheduleItemNotification(event);

    // Sincronizar com o calendário do celular se habilitado nas configurações
    if (get().syncWithDeviceCalendar) {
      const deviceEventId = await syncEventToDeviceCalendar(event);
      if (deviceEventId) {
        event.deviceCalendarEventId = deviceEventId;
      }
    }

    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
    return event;
  },

  toggleReminderCompleted: async (id) => {
    const updated = await ItemRepository.toggleReminderCompleted(id);
    if (updated && updated.notificationId && updated.completed) {
      // Se concluiu o lembrete, cancela a notificação agendada
      await cancelItemNotification(updated.notificationId);
    }
    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
  },

  deleteItem: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (item && item.type === "reminder" && item.notificationId) {
      await cancelItemNotification(item.notificationId);
    }
    await ItemRepository.deleteItem(id);
    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
  },

  convertNoteToReminder: async (noteId, dueDate) => {
    const reminder = await ItemRepository.convertNoteToReminder(noteId, dueDate);
    if (reminder && reminder.dueDate) {
      await scheduleItemNotification(reminder);
    }
    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
    return reminder;
  },

  convertReminderToEvent: async (reminderId, startAt, endAt) => {
    const event = await ItemRepository.convertReminderToEvent(reminderId, startAt, endAt);
    if (event) {
      await scheduleItemNotification(event);
      if (get().syncWithDeviceCalendar) {
        await syncEventToDeviceCalendar(event);
      }
    }
    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
    return event;
  },

  createNoteFromEvent: async (eventId) => {
    const note = await ItemRepository.createNoteFromEvent(eventId);
    await get().fetchItems(get().filterType === "all" ? undefined : get().filterType);
    return note;
  },
}));
