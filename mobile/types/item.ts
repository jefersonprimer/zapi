export type ItemType = 'note' | 'reminder' | 'event';

export type Priority = 'none' | 'low' | 'medium' | 'high';

export type RepeatPattern = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface LocationTrigger {
  latitude: number;
  longitude: number;
  radius: number;
  triggerOn: 'enter' | 'exit';
  name: string;
}

export interface BaseItem {
  id: string;
  type: ItemType;
  title: string;
  content?: string;
  color?: string;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  deletedAt?: string | null;
  syncedAt?: string | null;
}

export interface NoteItem extends BaseItem {
  type: 'note';
  noteType: 'text' | 'checklist' | 'drawing';
  checklist?: ChecklistItem[];
}

export interface ReminderItem extends BaseItem {
  type: 'reminder';
  dueDate?: string; // ISO String
  completed: boolean;
  completedAt?: string | null;
  priority: Priority;
  repeat: RepeatPattern;
  locationTrigger?: LocationTrigger;
  notificationId?: string | null;
}

export interface EventItem extends BaseItem {
  type: 'event';
  start: string; // ISO String
  end: string;   // ISO String
  allDay: boolean;
  location?: string;
  participants: string[]; // User IDs or emails
  repeat: RepeatPattern;
  deviceCalendarEventId?: string | null;
}

export type AnyItem = NoteItem | ReminderItem | EventItem;

export type CreateNoteInput = Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt' | 'pinned' | 'archived' | 'tags'> & {
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
};

export type CreateReminderInput = Omit<ReminderItem, 'id' | 'createdAt' | 'updatedAt' | 'pinned' | 'archived' | 'tags' | 'completed'> & {
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
  completed?: boolean;
};

export type CreateEventInput = Omit<EventItem, 'id' | 'createdAt' | 'updatedAt' | 'pinned' | 'archived' | 'tags'> & {
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
};

export type CreateItemInput = CreateNoteInput | CreateReminderInput | CreateEventInput;
