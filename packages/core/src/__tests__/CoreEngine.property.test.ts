import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { CoreEngine } from "../CoreEngine.js";
import type { GitBackend } from "../git/GitBackend.js";

/**
 * Feature: git-file-status-diff-viewer
 * Property 2: CoreEngine.gitDiff delegates to GitBackend with the main repo root
 * Validates: Requirements 2.1
 */

describe("CoreEngine", () => {
  // Property 2: CoreEngine.gitDiff resolves the main repo root and delegates to
  // GitBackend.diff with that root and a repo-relative path.
  // Validates: Requirements 2.1
  it(
    "Property 2: gitDiff resolves the main repo root, makes the path relative, and delegates to GitBackend.diff",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Any non-empty string as the diff output (including empty, which means no diff)
          fc.string(),
          async (diffOutput) => {
            // Use fixed paths so the relative-path calculation is deterministic.
            const mainRepoRoot = "/test/repo";
            const kbRoot = "/test/repo/.arlo/worktrees/wt-123";
            const absoluteFilePath = "/test/repo/GLOSSARY.md";
            const expectedRelPath = "GLOSSARY.md"; // relative(mainRepoRoot, absoluteFilePath)

            // Arrange: build a mock GitBackend
            const mockDiff = vi.fn().mockResolvedValue(diffOutput);
            const mockGetMainRepoRoot = vi.fn().mockResolvedValue(mainRepoRoot);
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
              getMainRepoRoot: mockGetMainRepoRoot,
              getConfig: vi.fn(),
            };

            const engine = new CoreEngine({
              kbRoot,
              store: {} as never,
              forge: {} as never,
              agentKeyProvider: {} as never,
              git: mockGit,
            });

            // Act
            const result = await engine.gitDiff(absoluteFilePath);

            // Assert: result equals exactly what the backend returned
            expect(result).toBe(diffOutput);

            // Assert: getMainRepoRoot was called with kbRoot
            expect(mockGetMainRepoRoot).toHaveBeenCalledOnce();
            expect(mockGetMainRepoRoot).toHaveBeenCalledWith(kbRoot);

            // Assert: diff was called with the main repo root + repo-relative path
            expect(mockDiff).toHaveBeenCalledOnce();
            expect(mockDiff).toHaveBeenCalledWith(mainRepoRoot, expectedRelPath);
          },
        ),
        { numRuns: 50 },
      );
    },
  );
});
