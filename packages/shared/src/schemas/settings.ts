import { z } from "zod";

export const UserSettingsSchema = z.object({
  anthropicApiKey: z.string().optional(),
  kbRootPath: z.string().optional(),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  defaultBranch: z.string().default("main"),
});

export type UserSettings = z.infer<typeof UserSettingsSchema>;
