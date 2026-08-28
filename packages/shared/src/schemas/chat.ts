import { z } from "zod";

export const ChatRecordIdSchema = z.string().uuid();

export const MessageRoleSchema = z.enum(["user", "assistant", "tool"]);

export const ChatMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
});

export const ChatRecordSchema = z.object({
  id: ChatRecordIdSchema,
  userId: z.string(),
  messages: z.array(ChatMessageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChatRecord = z.infer<typeof ChatRecordSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
