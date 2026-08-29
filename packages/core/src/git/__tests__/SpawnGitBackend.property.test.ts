import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { EventEmitter } from "node:events";

/**
 * Property 1: SpawnGitBackend.diff delegates command arguments correctly
 * Validates: Requirements 1.2
 *
 * For any `repoDir` and `filePath`, calling `SpawnGitBackend.diff(repoDir, filePath)`
 * must invoke the git subprocess with arguments `["diff", "HEAD", "--", filePath]`
 * in `repoDir`, and must resolve with the raw stdout string that the subprocess produces.
 */

// Mock node:child_process before importing the module under test.
// Vitest hoists vi.mock calls, so this runs before any imports are resolved.
vi.mock("node:child_process", () => {
  return {
    spawn: vi.fn(),
  };
});

// Import AFTER the mock is registered so the module under test picks up the mock.
const { spawn } = await import("node:child_process");
const { SpawnGitBackend } = await import("../SpawnGitBackend.js");

// Helper: build a fake ChildProcess that emits the given stdout and closes with code 0.
function makeFakeProcess(stdoutData: string) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  // Emit asynchronously so the Promise executor can attach listeners first.
  setImmediate(() => {
    proc.stdout.emit("data", Buffer.from(stdoutData));
    proc.emit("close", 0);
  });

  return proc;
}

describe("SpawnGitBackend — Property 1: diff delegates command arguments correctly", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("invokes git with ['diff', 'HEAD', '--', filePath] in repoDir and resolves with stdout", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary non-empty repoDir and filePath strings (no null bytes which are invalid in paths)
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => !s.includes("\0")),
        fc.string({ minLength: 1, maxLength: 80 }).filter((s) => !s.includes("\0")),
        // Arbitrary stdout content the mock process will emit
        fc.string({ minLength: 0, maxLength: 200 }),
        async (repoDir, filePath, mockStdout) => {
          const fakeProc = makeFakeProcess(mockStdout);
          vi.mocked(spawn).mockReturnValueOnce(fakeProc as ReturnType<typeof spawn>);

          const backend = new SpawnGitBackend();
          const result = await backend.diff(repoDir, filePath);

          // Assert: spawn was called exactly once
          expect(spawn).toHaveBeenCalledTimes(1);

          const [cmd, args, opts] = vi.mocked(spawn).mock.calls[0] as [
            string,
            string[],
            { cwd?: string },
          ];

          // Assert: git is the command
          expect(cmd).toBe("git");

          // Assert: arguments are exactly ["diff", "HEAD", "--", filePath]
          expect(args).toEqual(["diff", "HEAD", "--", filePath]);

          // Assert: cwd is the repoDir
          expect(opts?.cwd).toBe(repoDir);

          // Assert: resolved value equals the raw stdout the subprocess produced
          expect(result).toBe(mockStdout);

          vi.resetAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});
