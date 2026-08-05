import { getDatabase } from "./database";
import { generateUUIDv7 } from "./uuidv7";
import {
  AnyItem,
  NoteItem,
  ReminderItem,
  EventItem,
  ItemType,
  CreateNoteInput,
  CreateReminderInput,
  CreateEventInput,
  CreateItemInput,
} from "@/types/item";

export class ItemRepository {
  /**
   * Converte uma linha retornada pelo SQLite no objeto fortemente tipado AnyItem.
   */
  private static parseRowToItem(row: any): AnyItem {
    const base = {
      id: row.id,
      type: row.type as ItemType,
      title: row.title,
      content: row.content || undefined,
      color: row.color || undefined,
      pinned: Boolean(row.pinned),
      archived: Boolean(row.archived),
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at || null,
      syncedAt: row.synced_at || null,
    };

    if (row.type === "note") {
      return {
        ...base,
        type: "note",
        noteType: row.note_type || "text",
        checklist: row.checklist_json ? JSON.parse(row.checklist_json) : [],
      } as NoteItem;
    } else if (row.type === "reminder") {
      return {
        ...base,
        type: "reminder",
        dueDate: row.due_date || undefined,
        completed: Boolean(row.completed),
        completedAt: row.completed_at || null,
        priority: row.priority || "none",
        repeat: row.repeat_pattern || "none",
        locationTrigger: row.location_trigger_json
          ? JSON.parse(row.location_trigger_json)
          : undefined,
        notificationId: row.notification_id || null,
      } as ReminderItem;
    } else {
      return {
        ...base,
        type: "event",
        start: row.start_at,
        end: row.end_at,
        allDay: Boolean(row.all_day),
        location: row.location || undefined,
        participants: row.participants_json
          ? JSON.parse(row.participants_json)
          : [],
        repeat: row.repeat_pattern || "none",
        deviceCalendarEventId: row.device_calendar_event_id || null,
      } as EventItem;
    }
  }

  /**
   * Cria uma nova Nota localmente
   */
  static async createNote(input: CreateNoteInput): Promise<NoteItem> {
    const db = await getDatabase();
    const id = generateUUIDv7();
    const now = new Date().toISOString();

    const pinned = input.pinned ? 1 : 0;
    const archived = input.archived ? 1 : 0;
    const tagsJson = JSON.stringify(input.tags || []);
    const checklistJson = JSON.stringify(input.checklist || []);

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO items (id, type, title, content, color, pinned, archived, tags_json, created_at, updated_at)
         VALUES (?, 'note', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.title,
          input.content || null,
          input.color || null,
          pinned,
          archived,
          tagsJson,
          now,
          now,
        ]
      );

      await db.runAsync(
        `INSERT INTO note_details (item_id, note_type, checklist_json)
         VALUES (?, ?, ?)`,
        [id, input.noteType || "text", checklistJson]
      );
    });

    return (await this.getItemById(id)) as NoteItem;
  }

  /**
   * Cria um novo Lembrete localmente
   */
  static async createReminder(input: CreateReminderInput): Promise<ReminderItem> {
    const db = await getDatabase();
    const id = generateUUIDv7();
    const now = new Date().toISOString();

    const pinned = input.pinned ? 1 : 0;
    const archived = input.archived ? 1 : 0;
    const completed = input.completed ? 1 : 0;
    const completedAt = input.completed ? now : null;
    const tagsJson = JSON.stringify(input.tags || []);
    const locationJson = input.locationTrigger
      ? JSON.stringify(input.locationTrigger)
      : null;

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO items (id, type, title, content, color, pinned, archived, tags_json, created_at, updated_at)
         VALUES (?, 'reminder', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.title,
          input.content || null,
          input.color || null,
          pinned,
          archived,
          tagsJson,
          now,
          now,
        ]
      );

      await db.runAsync(
        `INSERT INTO reminder_details (item_id, due_date, completed, completed_at, priority, repeat_pattern, location_trigger_json, notification_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.dueDate || null,
          completed,
          completedAt,
          input.priority || "none",
          input.repeat || "none",
          locationJson,
          input.notificationId || null,
        ]
      );
    });

    return (await this.getItemById(id)) as ReminderItem;
  }

  /**
   * Cria um novo Evento localmente
   */
  static async createEvent(input: CreateEventInput): Promise<EventItem> {
    const db = await getDatabase();
    const id = generateUUIDv7();
    const now = new Date().toISOString();

    const pinned = input.pinned ? 1 : 0;
    const archived = input.archived ? 1 : 0;
    const allDay = input.allDay ? 1 : 0;
    const tagsJson = JSON.stringify(input.tags || []);
    const participantsJson = JSON.stringify(input.participants || []);

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO items (id, type, title, content, color, pinned, archived, tags_json, created_at, updated_at)
         VALUES (?, 'event', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.title,
          input.content || null,
          input.color || null,
          pinned,
          archived,
          tagsJson,
          now,
          now,
        ]
      );

      await db.runAsync(
        `INSERT INTO event_details (item_id, start_at, end_at, all_day, location, participants_json, repeat_pattern, device_calendar_event_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.start,
          input.end,
          allDay,
          input.location || null,
          participantsJson,
          input.repeat || "none",
          input.deviceCalendarEventId || null,
        ]
      );
    });

    return (await this.getItemById(id)) as EventItem;
  }

  /**
   * Busca um Item por ID
   */
  static async getItemById(id: string): Promise<AnyItem | null> {
    const db = await getDatabase();
    const query = `
      SELECT i.*, 
             nd.note_type, nd.checklist_json,
             rd.due_date, rd.completed, rd.completed_at, rd.priority, rd.repeat_pattern as reminder_repeat, rd.location_trigger_json, rd.notification_id,
             ed.start_at, ed.end_at, ed.all_day, ed.location, ed.participants_json, ed.repeat_pattern as event_repeat, ed.device_calendar_event_id
      FROM items i
      LEFT JOIN note_details nd ON i.id = nd.item_id
      LEFT JOIN reminder_details rd ON i.id = rd.item_id
      LEFT JOIN event_details ed ON i.id = ed.item_id
      WHERE i.id = ? AND i.deleted_at IS NULL
    `;
    const rows = await db.getAllAsync<any>(query, [id]);
    if (rows.length === 0) return null;

    const row = rows[0];
    if (row.type === "reminder") row.repeat_pattern = row.reminder_repeat;
    if (row.type === "event") row.repeat_pattern = row.event_repeat;

    return this.parseRowToItem(row);
  }

  /**
   * Busca todos os items (ou filtrados por tipo)
   */
  static async getItems(options?: {
    type?: ItemType;
    includeArchived?: boolean;
  }): Promise<AnyItem[]> {
    const db = await getDatabase();
    let query = `
      SELECT i.*, 
             nd.note_type, nd.checklist_json,
             rd.due_date, rd.completed, rd.completed_at, rd.priority, rd.repeat_pattern as reminder_repeat, rd.location_trigger_json, rd.notification_id,
             ed.start_at, ed.end_at, ed.all_day, ed.location, ed.participants_json, ed.repeat_pattern as event_repeat, ed.device_calendar_event_id
      FROM items i
      LEFT JOIN note_details nd ON i.id = nd.item_id
      LEFT JOIN reminder_details rd ON i.id = rd.item_id
      LEFT JOIN event_details ed ON i.id = ed.item_id
      WHERE i.deleted_at IS NULL
    `;

    const params: any[] = [];

    if (options?.type) {
      query += ` AND i.type = ?`;
      params.push(options.type);
    }

    if (!options?.includeArchived) {
      query += ` AND i.archived = 0`;
    }

    query += ` ORDER BY i.pinned DESC, i.updated_at DESC`;

    const rows = await db.getAllAsync<any>(query, params);
    return rows.map((row) => {
      if (row.type === "reminder") row.repeat_pattern = row.reminder_repeat;
      if (row.type === "event") row.repeat_pattern = row.event_repeat;
      return this.parseRowToItem(row);
    });
  }

  /**
   * Alternar o status de conclusão de um lembrete
   */
  static async toggleReminderCompleted(id: string, completed?: boolean): Promise<ReminderItem | null> {
    const db = await getDatabase();
    const current = await this.getItemById(id);
    if (!current || current.type !== "reminder") return null;

    const newCompleted = completed !== undefined ? completed : !current.completed;
    const now = new Date().toISOString();
    const completedAt = newCompleted ? now : null;

    await db.runAsync(
      `UPDATE reminder_details SET completed = ?, completed_at = ? WHERE item_id = ?`,
      [newCompleted ? 1 : 0, completedAt, id]
    );

    await db.runAsync(`UPDATE items SET updated_at = ? WHERE id = ?`, [now, id]);

    return (await this.getItemById(id)) as ReminderItem;
  }

  /**
   * Soft Delete de um Item
   */
  static async deleteItem(id: string): Promise<boolean> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const result = await db.runAsync(
      `UPDATE items SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
    return result.changes > 0;
  }

  /**
   * CONVERSOR: Converte uma Nota em Lembrete
   */
  static async convertNoteToReminder(
    noteId: string,
    dueDate?: string
  ): Promise<ReminderItem | null> {
    const db = await getDatabase();
    const item = await this.getItemById(noteId);
    if (!item || item.type !== "note") return null;

    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE items SET type = 'reminder', updated_at = ? WHERE id = ?`, [
        now,
        noteId,
      ]);
      await db.runAsync(`DELETE FROM note_details WHERE item_id = ?`, [noteId]);
      await db.runAsync(
        `INSERT INTO reminder_details (item_id, due_date, completed, priority, repeat_pattern)
         VALUES (?, ?, 0, 'none', 'none')`,
        [noteId, dueDate || now]
      );
    });

    return (await this.getItemById(noteId)) as ReminderItem;
  }

  /**
   * CONVERSOR: Converte um Lembrete em Evento
   */
  static async convertReminderToEvent(
    reminderId: string,
    startAt?: string,
    endAt?: string
  ): Promise<EventItem | null> {
    const db = await getDatabase();
    const item = await this.getItemById(reminderId);
    if (!item || item.type !== "reminder") return null;

    const now = new Date().toISOString();
    const start = startAt || item.dueDate || now;
    const end = endAt || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(); // +1 hour default

    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE items SET type = 'event', updated_at = ? WHERE id = ?`, [
        now,
        reminderId,
      ]);
      await db.runAsync(`DELETE FROM reminder_details WHERE item_id = ?`, [reminderId]);
      await db.runAsync(
        `INSERT INTO event_details (item_id, start_at, end_at, all_day, participants_json, repeat_pattern)
         VALUES (?, ?, ?, 0, '[]', 'none')`,
        [reminderId, start, end]
      );
    });

    return (await this.getItemById(reminderId)) as EventItem;
  }

  /**
   * CONVERSOR: Cria uma Nota a partir de um Evento
   */
  static async createNoteFromEvent(eventId: string): Promise<NoteItem | null> {
    const item = await this.getItemById(eventId);
    if (!item || item.type !== "event") return null;

    const newNote = await this.createNote({
      title: `Notas: ${item.title}`,
      content: `Anotações da reunião/evento realizado em ${new Date(item.start).toLocaleString('pt-BR')}.\n\nLocal: ${item.location || 'Não informado'}\n\n- `,
      noteType: 'text',
      tags: [...item.tags, 'reunião'],
    });

    return newNote;
  }
}
