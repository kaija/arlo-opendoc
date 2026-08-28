import { z } from "zod";

export const GitStatusFileSchema = z.object({
  path: z.string(),
  status: z.enum(["added", "modified", "deleted", "untracked", "renamed"]),
  oldPath: z.string().optional(),
});

export const GitStatusSchema = z.object({
  branch: z.string(),
  ahead: z.number().int().min(0),
  behind: z.number().int().min(0),
  files: z.array(GitStatusFileSchema),
});

export const GitCommitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  message: z.string(),
  author: z.string(),
  timestamp: z.string().datetime(),
});

export type GitStatus = z.infer<typeof GitStatusSchema>;
export type GitCommit = z.infer<typeof GitCommitSchema>;
