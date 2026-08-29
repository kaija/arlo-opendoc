import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { createIpcBinding } from "../ipc.js";
import type { ElectronIpcRenderer } from "../ipc.js";

/**
 * Feature: git-file-status-diff-viewer
 * Tests: IPC binding property-based tests
 * Validates: Requirements 2.3
 */

describe("IPC binding — gitDiff", () => {
  /**
   * Property 3: IPC binding routes gitDiff to the correct channel
   * Validates: Requirements 2.3
   *
   * For any filePath string, invoking ipcBinding.gitDiff(filePath) must call
   * ipcRenderer.invoke with channel "arlo-doc:gitDiff" and filePath as the
   * sole additional argument.
   */
  it("Property 3: gitDiff always invokes the 'arlo-doc:gitDiff' channel with filePath as the sole argument", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary filePath strings (filter null bytes which are invalid in paths)
        fc.string({ minLength: 0, maxLength: 200 }).filter((s) => !s.includes("\0")),
        (filePath) => {
          const mockInvoke = vi.fn().mockResolvedValue("mock-diff-output");
          const mockIpcRenderer: ElectronIpcRenderer = {
            invoke: mockInvoke,
          };

          const binding = createIpcBinding(mockIpcRenderer);
          // Fire the call but don't await — we only need to verify invoke args
          binding.gitDiff(filePath);

          // ipcRenderer.invoke must be called exactly once
          expect(mockInvoke).toHaveBeenCalledTimes(1);

          // First argument must be the channel name
          const [channel, ...rest] = mockInvoke.mock.calls[0] as [string, ...unknown[]];
          expect(channel).toBe("arlo-doc:gitDiff");

          // filePath must be the sole additional argument
          expect(rest).toHaveLength(1);
          expect(rest[0]).toBe(filePath);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 3 (resolved value): gitDiff wraps the channel result in KbResult<string>", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 200 }).filter((s) => !s.includes("\0")),
        fc.string({ minLength: 0, maxLength: 500 }),
        async (filePath, diffOutput) => {
          const mockIpcRenderer: ElectronIpcRenderer = {
            invoke: vi.fn().mockResolvedValue(diffOutput),
          };

          const binding = createIpcBinding(mockIpcRenderer);
          const result = await binding.gitDiff(filePath);

          // Must always resolve to { ok: true, data: diffOutput }
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.data).toBe(diffOutput);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
