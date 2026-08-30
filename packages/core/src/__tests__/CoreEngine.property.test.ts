import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { CoreEngine } from "../CoreEngine.js";
import type { GitBackend } from "../git/GitBackend.js";

/**
 * Feature: git-file-status-diff-viewer
 * Property 2: CoreEngine.gitDiff delegates to GitBackend with kbRoot
 * Validates: Requirements 2.1
 */

describe("CoreEngine", () => {
  // Property 2: CoreEngine.gitDiff delegates to GitBackend with kbRoot
  // Validates: Requirements 2.1
  it(
    "Property 2: gitDiff delegates to GitBackend.diff with kbRoot and returns its value",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Any non-empty string as the file path
          fc.string({ minLength: 1 }),
          // Any string as the diff output (including empty, which means no diff)
          fc.string(),
          async (filePath, diffOutput) => {
            // Arrange: build a mock GitBackend whose diff() returns diffOutput
            const mockDiff = vi.fn().mockResolvedValue(diffOutput);
            const mockGit: GitBackend = {
              clone: vi.fn(),
              status: vi.fn(),
              commit: vi.fn(),
              push: vi.fn(),
              pull: vi.fn(),
              diff: mockDiff,
              worktreeAdd: vi.fn(),
              worktreeRemove: vi.fn(),
              worktreeList: vi.fn(),
              worktreeDirty: vi.fn(),
              getRepoRoot: vi.fn(),
              getConfig: vi.fn(),
            };

            const kbRoot = "/test/repo/root";
            const engine = new CoreEngine({
              kbRoot,
              store: {} as never,
              forge: {} as never,
              agentKeyProvider: {} as never,
              git: mockGit,
            });

            // Act
            const result = await engine.gitDiff(filePath);

            // Assert: result equals exactly what the backend returned
            expect(result).toBe(diffOutput);

            // Assert: backend was called exactly once with (kbRoot, filePath)
            expect(mockDiff).toHaveBeenCalledOnce();
            expect(mockDiff).toHaveBeenCalledWith(kbRoot, filePath);
          },
        ),
        { numRuns: 50 },
      );
    },
  );
});
