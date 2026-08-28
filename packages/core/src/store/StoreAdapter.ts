import type {
  ChatRecord,
  ChatMessage,
  UserSettings,
} from "@arlo-doc/shared";

export interface StoreAdapter {
  // Chat operations
  createChatRecord(record: Omit<ChatRecord, "id" | "createdAt" | "updatedAt">): Promise<ChatRecord>;
  readChatRecord(id: string): Promise<ChatRecord | null>;
  updateChatRecord(id: string, messages: ChatMessage[]): Promise<ChatRecord>;
  deleteChatRecord(id: string): Promise<void>;

  // Settings
  readSettings(): Promise<UserSettings>;
  writeSettings(settings: Partial<UserSettings>): Promise<UserSettings>;
}
