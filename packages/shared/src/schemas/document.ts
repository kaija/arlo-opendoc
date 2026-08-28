import { z } from "zod";

export const DocumentIdSchema = z.string().uuid();

export const KbDocumentSchema = z.object({
  id: DocumentIdSchema,
  path: z.string().min(1),
  title: z.string(),
  content: z.string(),
  frontmatter: z.record(z.unknown()).optional(),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KbDocument = z.infer<typeof KbDocumentSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export const SearchResultSchema = z.object({
  document: KbDocumentSchema,
  score: z.number(),
  excerpt: z.string(),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
