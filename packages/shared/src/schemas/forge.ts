import { z } from "zod";

export const ForgeRepoSchema = z.object({
  owner: z.string(),
  name: z.string(),
  cloneUrl: z.string().url(),
  defaultBranch: z.string(),
  isPrivate: z.boolean(),
});

export const OAuthTokenSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  scope: z.string(),
  expiresAt: z.string().datetime().optional(),
});

export type ForgeRepo = z.infer<typeof ForgeRepoSchema>;
export type OAuthToken = z.infer<typeof OAuthTokenSchema>;
