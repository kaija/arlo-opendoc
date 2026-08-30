import type {
  ChatRecord,
  ChatMessage,
  AppSettings,
} from "@arlo-doc/shared";

export interface StoreAdapter {
  // Chat operations
  createChatRecord(record: Omit<ChatRecord, "id" | "createdAt" | "updatedAt">): Promise<ChatRecord>;
  readChatRecord(id: string): Promise<ChatRecord | null>;
  updateChatRecord(id: string, messages: ChatMessage[]): Promise<ChatRecord>;
  deleteChatRecord(id: string): Promise<void>;

  // Settings — application scope only. Knowledge-base settings are keyed by
  // repository path and handled by the host, and secrets never pass through
  // this adapter: they live in an OS-encrypted store the host owns.
  readSettings(): Promise<AppSettings>;
  writeSettings(settings: Partial<AppSettings>): Promise<AppSettings>;
}
