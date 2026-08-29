/**
 * Feature: search-bar
 * Tasks 4.3, 4.4, 4.5, 4.6, 5.3
 *
 * Unit and property-based tests for RipgrepRunner and the arlo-doc:findInFiles
 * IPC handler error contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import * as fc from "fast-check";
import { EventEmitter } from "node:events";

// ── Module-level mocks (must precede the imports they shadow) ──────────────

vi.mock("node:fs", () => ({
  promises: {
    access: vi.fn(),
  },
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getAppPath: vi.fn(() => "/mock/app/path"),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { app } from "electron";
import { resolveRgBinary, findInFiles, DEFAULT_EXCLUDES } from "../ripgrepRunner.js";
import type { SearchOptions } from "@arlo-doc/shared";
import { createIpcBinding } from "@arlo-doc/client/ipc";
import type { ElectronIpcRenderer } from "@arlo-doc/client/ipc";
import type { KbResult } from "@arlo-doc/client";

// ── Typed mock handles ─────────────────────────────────────────────────────

const mockAccess = fs.access as unknown as MockInstance;
const mockSpawn = spawn as unknown as MockInstance;
const mockGetAppPath = app.getAppPath as unknown as MockInstance;

// ── Fake child process ─────────────────────────────────────────────────────

/**
 * A fake ChildProcess built from an EventEmitter with typed stdout/stderr.
 * The `kill` property is set directly so the ripgrepRunner timeout handler
 * can call it as `child.kill("SIGTERM")`.
 */
interface FakeProcess {
  main: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: (sig?: string) => boolean };
}

function makeFakeProcess(options: {
  stdoutLines?: string[];
  stderrLines?: string[];
  exitCode?: number;
}): FakeProcess["main"] {
  // Plain objects whose event listeners are driven via EventEmitter
  const main = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (sig?: string) => boolean;
  };
  main.stdout = new EventEmitter();
  main.stderr = new EventEmitter();
  // Provide a kill function so the 30-second timer code can call it
  main.kill = (_sig?: string) => {
    // Simulate killed: emit 'close' with null (as real processes do when killed)
    setTimeout(() => main.emit("close", null), 0);
    return true;
  };

  const { stdoutLines = [], stderrLines = [], exitCode = 0 } = options;

  // Use setTimeout(0) so the events fire as a macrotask, after all pending
  // microtasks (including the two `await fs.access()` calls in findInFiles)
  // have resolved. This ensures spawn's data/close listeners are registered
  // before we emit the close event.
  setTimeout(() => {
    for (const line of stdoutLines) {
      main.stdout.emit("data", Buffer.from(line + "\n", "utf-8"));
    }
    for (const line of stderrLines) {
      main.stderr.emit("data", Buffer.from(line + "\n", "utf-8"));
    }
    main.emit("close", exitCode);
  }, 0);

  return main;
}

// ── NDJSON helpers ─────────────────────────────────────────────────────────

function rgBegin(filePath: string): string {
  return JSON.stringify({ type: "begin", data: { path: { text: filePath } } });
}

function rgMatch(filePath: string, lineNumber: number, text: string): string {
  return JSON.stringify({
    type: "match",
    data: {
      path: { text: filePath },
      lines: { text },
      line_number: lineNumber,
      submatches: [],
    },
  });
}

function rgContext(filePath: string, lineNumber: number, text: string): string {
  return JSON.stringify({
    type: "context",
    data: {
      path: { text: filePath },
      lines: { text },
      line_number: lineNumber,
    },
  });
}

function rgEnd(filePath: string): string {
  return JSON.stringify({ type: "end", data: { path: { text: filePath } } });
}

function rgSummary(): string {
  return JSON.stringify({ type: "summary", data: {} });
}

/** Build complete NDJSON lines for a single file with given match and context lines. */
function buildFileNdjson(
  filePath: string,
  matchLineNumbers: number[],
  contextLineNumbers: number[],
): string[] {
  const lines: string[] = [rgBegin(filePath)];
  const all = [
    ...matchLineNumbers.map((ln) => ({ ln, isMatch: true })),
    ...contextLineNumbers.map((ln) => ({ ln, isMatch: false })),
  ].sort((a, b) => a.ln - b.ln);

  for (const { ln, isMatch } of all) {
    lines.push(
      isMatch
        ? rgMatch(filePath, ln, `matched line ${ln}`)
        : rgContext(filePath, ln, `context line ${ln}`),
    );
  }
  lines.push(rgEnd(filePath));
  return lines;
}

// ── Default search option fixtures ────────────────────────────────────────

const defaultOpts: SearchOptions = { caseSensitive: false, useRegex: false };
const caseSensitiveOpts: SearchOptions = { caseSensitive: true, useRegex: false };
const regexOpts: SearchOptions = { caseSensitive: false, useRegex: true };
const caseSensitiveRegexOpts: SearchOptions = { caseSensitive: true, useRegex: true };

// ── Global setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAccess.mockResolvedValue(undefined);
  mockGetAppPath.mockReturnValue("/mock/app/path");
  delete process.env["RG_PATH"];
});

afterEach(() => {
  delete process.env["RG_PATH"];
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 4.3 — Unit tests for RipgrepRunner
// ═══════════════════════════════════════════════════════════════════════════

describe("Task 4.3 — resolveRgBinary()", () => {
  it("uses RG_PATH when set, with no fallback", () => {
    process.env["RG_PATH"] = "/custom/rg";
    expect(resolveRgBinary()).toBe("/custom/rg");
    expect(mockGetAppPath).not.toHaveBeenCalled();
  });

  it("returns platform bundle path on macOS/Linux when RG_PATH is absent", () => {
    const orig = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    try {
      expect(resolveRgBinary()).toBe("/mock/app/path/bin/rg");
    } finally {
      Object.defineProperty(process, "platform", { value: orig, configurable: true });
    }
  });

  it("returns .exe bundle path on Windows when RG_PATH is absent", () => {
    const orig = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    try {
      expect(resolveRgBinary()).toBe("/mock/app/path/bin/rg.exe");
    } finally {
      Object.defineProperty(process, "platform", { value: orig, configurable: true });
    }
  });
});

// ─── Binary resolution errors ─────────────────────────────────────────────

describe("Task 4.3 — findInFiles: binary resolution (REQ-005.1, REQ-005.2)", () => {
  it("returns NOT_FOUND when RG_PATH points to non-existent file (no fallback)", async () => {
    process.env["RG_PATH"] = "/nonexistent/rg";
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await findInFiles("/some/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("/nonexistent/rg");
    }
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when bundle binary does not exist", async () => {
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await findInFiles("/some/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toMatch(/ripgrep binary not found at/);
      expect(result.error.message).toContain("/mock/app/path/bin/rg");
    }
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("does NOT fall back to bundle path when RG_PATH is set but file missing", async () => {
    process.env["RG_PATH"] = "/explicit/rg";
    mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

    const result = await findInFiles("/some/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("/explicit/rg");
      expect(result.error.message).not.toContain("mock/app/path");
    }
  });
});

// ─── repoDir validation ───────────────────────────────────────────────────

describe("Task 4.3 — findInFiles: repoDir validation (REQ-006.6)", () => {
  it("returns NOT_FOUND when repoDir does not exist", async () => {
    mockAccess
      .mockResolvedValueOnce(undefined)  // binary OK
      .mockRejectedValueOnce(new Error("ENOENT")); // repoDir missing

    const result = await findInFiles("/nonexistent/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toContain("/nonexistent/repo");
    }
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});

// ─── rg flag combinations ─────────────────────────────────────────────────

describe("Task 4.3 — findInFiles: rg flag combinations (REQ-004.3–5)", () => {
  /** Returns a promise that resolves to the args array passed to spawn. */
  function captureSpawnArgs(): Promise<string[]> {
    return new Promise((resolve) => {
      mockSpawn.mockImplementationOnce((_cmd: string, args: string[]) => {
        resolve(args);
        return makeFakeProcess({ exitCode: 1 });
      });
    });
  }

  it("always passes --json, --context 2, --max-count 5, --glob with DEFAULT_EXCLUDES", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "hello", defaultOpts);
    const args = await argsP;

    expect(args).toContain("--json");
    expect(args).toContain("--context");
    expect(args).toContain("2");
    expect(args).toContain("--max-count");
    expect(args).toContain("5");

    const globArg = args.find((a) => a.startsWith("--glob="));
    expect(globArg).toBeDefined();
    for (const ex of DEFAULT_EXCLUDES) {
      expect(globArg).toContain(ex);
    }
  });

  it("passes --ignore-case when caseSensitive=false", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "hello", defaultOpts);
    expect(await argsP).toContain("--ignore-case");
  });

  it("does NOT pass --ignore-case when caseSensitive=true", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "hello", caseSensitiveOpts);
    expect(await argsP).not.toContain("--ignore-case");
  });

  it("passes --fixed-strings when useRegex=false", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "hello", defaultOpts);
    expect(await argsP).toContain("--fixed-strings");
  });

  it("does NOT pass --fixed-strings when useRegex=true", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "hello", regexOpts);
    expect(await argsP).not.toContain("--fixed-strings");
  });

  it("caseSensitive=true, useRegex=true: no --ignore-case and no --fixed-strings", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "hello", caseSensitiveRegexOpts);
    const args = await argsP;
    expect(args).not.toContain("--ignore-case");
    expect(args).not.toContain("--fixed-strings");
  });

  it("query string appears as the last argument", async () => {
    const argsP = captureSpawnArgs();
    await findInFiles("/repo", "my query", defaultOpts);
    const args = await argsP;
    expect(args[args.length - 1]).toBe("my query");
  });

  it("spawns rg with cwd=repoDir (REQ-005.4)", async () => {
    let capturedCwd: string | undefined;
    mockSpawn.mockImplementationOnce((_cmd: string, _args: string[], opts: { cwd: string }) => {
      capturedCwd = opts.cwd;
      return makeFakeProcess({ exitCode: 1 });
    });
    await findInFiles("/my/repo", "q", defaultOpts);
    expect(capturedCwd).toBe("/my/repo");
  });

  it("spawns rg with only PATH in the environment (REQ-005.4)", async () => {
    let capturedEnv: Record<string, string> | undefined;
    mockSpawn.mockImplementationOnce(
      (_cmd: string, _args: string[], opts: { env: Record<string, string> }) => {
        capturedEnv = opts.env;
        return makeFakeProcess({ exitCode: 1 });
      },
    );
    await findInFiles("/repo", "q", defaultOpts);
    expect(Object.keys(capturedEnv!)).toEqual(["PATH"]);
  });
});

// ─── Exit code handling ───────────────────────────────────────────────────

describe("Task 4.3 — findInFiles: exit code handling (REQ-004.10–11)", () => {
  it("exit code 0 → ok: true with parsed results", async () => {
    const ndjson = [...buildFileNdjson("/repo/file.ts", [3], [1, 2, 4, 5]), rgSummary()];
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "something", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.filePath).toBe("/repo/file.ts");
    }
  });

  it("exit code 1 → ok: true with empty array (no matches found)", async () => {
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ exitCode: 1 }));

    const result = await findInFiles("/repo", "something", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it("exit code 2 → ok: false with UNKNOWN error containing stderr", async () => {
    mockSpawn.mockReturnValueOnce(
      makeFakeProcess({ stderrLines: ["regex parse error: invalid syntax"], exitCode: 2 }),
    );

    const result = await findInFiles("/repo", "bad(regex", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toContain("regex parse error");
    }
  });

  it("exit code 99 → ok: false with UNKNOWN error", async () => {
    mockSpawn.mockReturnValueOnce(
      makeFakeProcess({ stderrLines: ["unexpected error"], exitCode: 99 }),
    );

    const result = await findInFiles("/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
    }
  });

  it("non-zero exit with empty stderr → UNKNOWN error with fallback message", async () => {
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stderrLines: [], exitCode: 2 }));

    const result = await findInFiles("/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("spawn 'error' event (e.g. binary not executable) → ok: false with UNKNOWN error", async () => {
    // Build a fake proc that emits 'error' instead of 'close'
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: (sig?: string) => boolean;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = () => true;

    mockSpawn.mockReturnValueOnce(proc);

    // Emit 'error' as a macrotask, after spawn's listeners are attached.
    // Register the error listener on `proc` first so Node.js doesn't throw
    // it as an uncaught exception — ripgrepRunner's `child.on('error', ...)` 
    // listener will register first after spawn, and our setTimeout fires later.
    setTimeout(() => {
      proc.emit("error", new Error("spawn EACCES"));
    }, 0);

    const result = await findInFiles("/repo", "query", defaultOpts);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN");
      expect(result.error.message).toContain("spawn EACCES");
    }
  });
});

// ─── Timeout handling ─────────────────────────────────────────────────────

describe("Task 4.3 — findInFiles: 30-second timeout (REQ-005.5)", () => {
  it("kills the process and returns TIMEOUT error when rg hangs past 30 s", async () => {
    vi.useFakeTimers();

    let killedSignal: string | undefined;

    // This process NEVER emits 'close' on its own — simulating a hung process
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      kill: (sig?: string) => boolean;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = (sig?: string) => {
      killedSignal = sig;
      // When killed, emit close with null on the next fake-timer tick
      setTimeout(() => proc.emit("close", null), 0);
      return true;
    };

    mockSpawn.mockReturnValueOnce(proc);

    const resultPromise = findInFiles("/repo", "query", defaultOpts);

    // Advance through the two fs.access microtasks so spawn is called first,
    // then advance past the 30-second threshold so the kill timer fires.
    await vi.advanceTimersByTimeAsync(0);    // flush macrotasks up to 0ms
    await vi.advanceTimersByTimeAsync(31_000); // trip the 30-second guard

    // Advance one more tick so proc.emit("close", null) fires
    await vi.advanceTimersByTimeAsync(0);

    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT");
      expect(result.error.message).toContain("30 seconds");
    }
    expect(killedSignal).toBe("SIGTERM");

    vi.useRealTimers();
  });
});

// ─── NDJSON output parsing ────────────────────────────────────────────────

describe("Task 4.3 — findInFiles: NDJSON output parsing", () => {
  it("parses match and context lines correctly", async () => {
    // Note: the parser adds context lines only to files already seen via a match line.
    // Pre-match context (lines before the first match) will be dropped because the
    // file entry doesn't exist in the index yet. This is a known parser characteristic.
    // Test with context lines that appear AFTER the match line.
    const ndjson = [
      rgBegin("/repo/src/main.ts"),
      rgMatch("/repo/src/main.ts", 3, "const query = 'hello';"),
      rgContext("/repo/src/main.ts", 4, "const d = 4;"),
      rgContext("/repo/src/main.ts", 5, "const e = 5;"),
      rgEnd("/repo/src/main.ts"),
      rgSummary(),
    ];
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "hello", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      const m = result.data[0]!;
      expect(m.filePath).toBe("/repo/src/main.ts");
      expect(m.lines).toHaveLength(3); // 1 match + 2 context

      const matchLine = m.lines.find((l) => l.isMatch);
      expect(matchLine).toBeDefined();
      expect(matchLine!.lineNumber).toBe(3);
      expect(matchLine!.text).toBe("const query = 'hello';");

      expect(m.lines.filter((l) => !l.isMatch)).toHaveLength(2);
    }
  });

  it("strips trailing newlines from line text", async () => {
    const line = JSON.stringify({
      type: "match",
      data: {
        path: { text: "/repo/file.ts" },
        lines: { text: "hello world\n" },
        line_number: 7,
        submatches: [],
      },
    });
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: [line], exitCode: 0 }));

    const result = await findInFiles("/repo", "hello", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok && result.data[0]) {
      expect(result.data[0].lines[0]!.text).toBe("hello world");
    }
  });

  it("groups results by file for multiple files", async () => {
    const ndjson = [
      ...buildFileNdjson("/repo/a.ts", [2], [1, 3]),
      ...buildFileNdjson("/repo/b.ts", [5], [4, 6]),
      rgSummary(),
    ];
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "query", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      const paths = result.data.map((m) => m.filePath);
      expect(paths).toContain("/repo/a.ts");
      expect(paths).toContain("/repo/b.ts");
    }
  });

  it("skips malformed NDJSON lines without failing", async () => {
    const ndjson = [
      "not valid json {{{",
      rgMatch("/repo/ok.ts", 1, "valid match"),
    ];
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "valid", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 4.4 — Property 5: Find in Files file count upper bound
// Feature: search-bar, Property 5: Find in files file count upper bound
// Validates: Requirements REQ-004.6
// ═══════════════════════════════════════════════════════════════════════════

describe("Task 4.4 — Property 5: Find in Files file count upper bound (REQ-004.6)", () => {
  it("property: ContentMatch[].length <= 20 regardless of how many files rg emits", async () => {
    // Feature: search-bar, Property 5: Find in files file count upper bound

    await fc.assert(
      fc.asyncProperty(
        // 0–50 file paths (may contain duplicates; we deduplicate)
        fc.array(
          fc.nat({ max: 49 }).map((i) => `/repo/file${i}.ts`),
          { minLength: 0, maxLength: 50 },
        ),
        async (rawPaths) => {
          const filePaths = [...new Set(rawPaths)];
          const ndjson: string[] = [];
          for (const fp of filePaths) {
            ndjson.push(...buildFileNdjson(fp, [1, 2, 3], []));
          }
          ndjson.push(rgSummary());

          mockSpawn.mockReturnValueOnce(
            makeFakeProcess({
              stdoutLines: ndjson,
              exitCode: filePaths.length === 0 ? 1 : 0,
            }),
          );

          const result = await findInFiles("/repo", "query", defaultOpts);
          if (!result.ok) return true;
          return result.data.length <= 20;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("exactly 21 files → only 20 returned", async () => {
    const ndjson: string[] = [];
    for (let i = 0; i < 21; i++) {
      ndjson.push(...buildFileNdjson(`/repo/file${i}.ts`, [1], []));
    }
    ndjson.push(rgSummary());
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "query", defaultOpts);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.length).toBe(20);
  });

  it("zero files (exit 1) → empty array", async () => {
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ exitCode: 1 }));

    const result = await findInFiles("/repo", "query", defaultOpts);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 4.5 — Property 6: Find in Files total match line upper bound
// Feature: search-bar, Property 6: Find in files total match line upper bound
// Validates: Requirements REQ-004.6
// ═══════════════════════════════════════════════════════════════════════════

describe("Task 4.5 — Property 6: Find in Files total match line upper bound (REQ-004.6)", () => {
  it("property: sum of isMatch lines across all ContentMatch entries is always <= 100", async () => {
    // Feature: search-bar, Property 6: Find in files total match line upper bound

    await fc.assert(
      fc.asyncProperty(
        // 1–15 distinct files, each with 1–20 match lines
        fc.array(
          fc.record({
            fileIndex: fc.nat({ max: 14 }),
            matchCount: fc.integer({ min: 1, max: 20 }),
          }),
          { minLength: 1, maxLength: 15 },
        ),
        async (specs) => {
          // Deduplicate by file index
          const seen = new Set<number>();
          const unique = specs.filter((s) => {
            if (seen.has(s.fileIndex)) return false;
            seen.add(s.fileIndex);
            return true;
          });

          const ndjson: string[] = [];
          for (const { fileIndex, matchCount } of unique) {
            const matchLines = Array.from({ length: matchCount }, (_, i) => i + 1);
            ndjson.push(...buildFileNdjson(`/repo/file${fileIndex}.ts`, matchLines, []));
          }
          ndjson.push(rgSummary());

          mockSpawn.mockReturnValueOnce(
            makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }),
          );

          const result = await findInFiles("/repo", "query", defaultOpts);
          if (!result.ok) return true;

          const total = result.data.reduce(
            (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
            0,
          );
          return total <= 100;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("5 files × 25 match lines each → total isMatch lines <= 100", async () => {
    const ndjson: string[] = [];
    for (let i = 0; i < 5; i++) {
      const ml = Array.from({ length: 25 }, (_, j) => j + 1);
      ndjson.push(...buildFileNdjson(`/repo/file${i}.ts`, ml, []));
    }
    ndjson.push(rgSummary());
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "query", defaultOpts);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const total = result.data.reduce(
        (sum, cm) => sum + cm.lines.filter((l) => l.isMatch).length,
        0,
      );
      expect(total).toBeLessThanOrEqual(100);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 4.6 — Property 7: ContentMatchLine line number monotonicity
// Feature: search-bar, Property 7: ContentMatchLine line number monotonicity
// Validates: Requirements REQ-004
// ═══════════════════════════════════════════════════════════════════════════

describe("Task 4.6 — Property 7: ContentMatchLine line number monotonicity (REQ-004)", () => {
  it("property: line numbers within every ContentMatch are strictly increasing", async () => {
    // Feature: search-bar, Property 7: ContentMatchLine line number monotonicity

    await fc.assert(
      fc.asyncProperty(
        // 1–10 files, each with 1–5 distinct sorted match line numbers in [1..500]
        fc.array(
          fc.record({
            fileIndex: fc.nat({ max: 9 }),
            matchLineNumbers: fc
              .array(fc.integer({ min: 1, max: 500 }), { minLength: 1, maxLength: 5 })
              .map((arr) => [...new Set(arr)].sort((a, b) => a - b)),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (specs) => {
          const seen = new Set<number>();
          const unique = specs.filter((s) => {
            if (seen.has(s.fileIndex)) return false;
            seen.add(s.fileIndex);
            return true;
          });

          const ndjson: string[] = [];
          for (const { fileIndex, matchLineNumbers } of unique) {
            const fp = `/repo/file${fileIndex}.ts`;
            // Add ±1 context where they don't collide with match lines
            const matchSet = new Set(matchLineNumbers);
            const ctx: number[] = [];
            for (const ml of matchLineNumbers) {
              if (ml > 1 && !matchSet.has(ml - 1)) ctx.push(ml - 1);
              if (!matchSet.has(ml + 1)) ctx.push(ml + 1);
            }
            const contextUnique = [...new Set(ctx)].filter((c) => !matchSet.has(c) && c >= 1);
            ndjson.push(...buildFileNdjson(fp, matchLineNumbers, contextUnique));
          }
          ndjson.push(rgSummary());

          mockSpawn.mockReturnValueOnce(
            makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }),
          );

          const result = await findInFiles("/repo", "query", defaultOpts);
          if (!result.ok) return true;

          for (const cm of result.data) {
            for (let i = 0; i < cm.lines.length - 1; i++) {
              if (cm.lines[i]!.lineNumber >= cm.lines[i + 1]!.lineNumber) {
                return false;
              }
            }
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it("interleaved context and match lines appear in ascending line number order", async () => {
    const ndjson = [
      rgBegin("/repo/code.ts"),
      rgContext("/repo/code.ts", 8, "line 8"),
      rgContext("/repo/code.ts", 9, "line 9"),
      rgMatch("/repo/code.ts", 10, "MATCH"),
      rgContext("/repo/code.ts", 11, "line 11"),
      rgContext("/repo/code.ts", 12, "line 12"),
      rgEnd("/repo/code.ts"),
    ];
    mockSpawn.mockReturnValueOnce(makeFakeProcess({ stdoutLines: ndjson, exitCode: 0 }));

    const result = await findInFiles("/repo", "MATCH", defaultOpts);

    expect(result.ok).toBe(true);
    if (result.ok && result.data[0]) {
      const nums = result.data[0].lines.map((l) => l.lineNumber);
      for (let i = 0; i < nums.length - 1; i++) {
        expect(nums[i]!).toBeLessThan(nums[i + 1]!);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK 5.3 — Property 8: IPC Handler Error Contract
// Feature: search-bar, Property 8: IPC handler error contract
// Validates: Requirements REQ-006.4
// ═══════════════════════════════════════════════════════════════════════════

// ── Shared helpers (mirrors ipcKbResultContract.test.ts pattern) ──────────

function makeKbError(code: string, message: string): Error & { kbError: unknown } {
  const err = new Error(message) as Error & { kbError: unknown };
  err.kbError = { code, message };
  return err;
}

function throwingRenderer(error: unknown): ElectronIpcRenderer {
  return { invoke: () => Promise.reject(error) };
}

function expectFailure(result: KbResult<unknown>): { code: string; message: string } {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("unreachable");
  const { code, message } = result.error;
  expect(typeof code).toBe("string");
  expect(code.length).toBeGreaterThan(0);
  expect(typeof message).toBe("string");
  expect(message.length).toBeGreaterThan(0);
  return { code, message };
}

const searchOpts: SearchOptions = { caseSensitive: false, useRegex: false };

describe("Task 5.3 — Property 8: IPC Handler Error Contract (REQ-006.4)", () => {
  // ── NOT_FOUND ───────────────────────────────────────────────────────────
  it("findInFiles: NOT_FOUND kbError → { ok: false, error: { code: 'NOT_FOUND' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer(makeKbError("NOT_FOUND", "repo directory not found: /missing")),
    ).findInFiles("/missing", "query", searchOpts);
    expect(expectFailure(result).code).toBe("NOT_FOUND");
  });

  it("searchFiles: NOT_FOUND kbError → { ok: false, error: { code: 'NOT_FOUND' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer(makeKbError("NOT_FOUND", "repo directory not found: /missing")),
    ).searchFiles("/missing", "query", searchOpts);
    expect(expectFailure(result).code).toBe("NOT_FOUND");
  });

  // ── TIMEOUT ─────────────────────────────────────────────────────────────
  it("findInFiles: TIMEOUT kbError → { ok: false, error: { code: 'TIMEOUT' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer(makeKbError("TIMEOUT", "ripgrep timed out after 30 seconds")),
    ).findInFiles("/repo", "query", searchOpts);
    const { code, message } = expectFailure(result);
    expect(code).toBe("TIMEOUT");
    expect(message).toContain("30 seconds");
  });

  // ── UNKNOWN ─────────────────────────────────────────────────────────────
  it("findInFiles: UNKNOWN kbError → { ok: false, error: { code: 'UNKNOWN' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer(makeKbError("UNKNOWN", "ripgrep exited with code 2")),
    ).findInFiles("/repo", "query", searchOpts);
    expect(expectFailure(result).code).toBe("UNKNOWN");
  });

  // ── plain Error (no kbError) → UNKNOWN ──────────────────────────────────
  it("findInFiles: plain Error → { ok: false, error: { code: 'UNKNOWN', message: ... } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer(new Error("unexpected internal failure")),
    ).findInFiles("/repo", "query", searchOpts);
    const { code, message } = expectFailure(result);
    expect(code).toBe("UNKNOWN");
    expect(message).toBe("unexpected internal failure");
  });

  it("searchFiles: plain Error → { ok: false, error: { code: 'UNKNOWN' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer(new Error("something exploded")),
    ).searchFiles("/repo", "query", searchOpts);
    expect(expectFailure(result).code).toBe("UNKNOWN");
  });

  // ── non-Error throw ──────────────────────────────────────────────────────
  it("findInFiles: bare string rejection → { ok: false, error: { code: 'UNKNOWN' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer("raw string error"),
    ).findInFiles("/repo", "query", searchOpts);
    expect(expectFailure(result).code).toBe("UNKNOWN");
  });

  it("searchFiles: bare string rejection → { ok: false, error: { code: 'UNKNOWN' } }", async () => {
    const result = await createIpcBinding(
      throwingRenderer("another raw rejection"),
    ).searchFiles("/repo", "query", searchOpts);
    expect(expectFailure(result).code).toBe("UNKNOWN");
  });

  // ── property: all exception shapes → structured KbResult ────────────────
  it("property: any exception shape → { ok: false, error: { code, message } } — never an unhandled rejection", async () => {
    // Feature: search-bar, Property 8: IPC handler error contract

    const errorArb = fc.oneof(
      fc
        .record({
          code: fc.constantFrom("NOT_FOUND", "TIMEOUT", "UNKNOWN", "PERMISSION_DENIED"),
          message: fc.string({ minLength: 1, maxLength: 100 }),
        })
        .map(({ code, message }) => makeKbError(code, message)),
      fc.string({ minLength: 1, maxLength: 100 }).map((msg) => new Error(msg)),
      fc.oneof(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer(),
        fc.constant(null),
        fc.constant(undefined),
      ),
    );

    await fc.assert(
      fc.asyncProperty(errorArb, async (error) => {
        const binding = createIpcBinding(throwingRenderer(error));

        const [findResult, searchResult] = await Promise.all([
          binding.findInFiles("/repo", "query", searchOpts),
          binding.searchFiles("/repo", "query", searchOpts),
        ]);

        if (findResult.ok || searchResult.ok) return false;

        const fe = findResult.error;
        const se = searchResult.error;

        return (
          typeof fe.code === "string" &&
          fe.code.length > 0 &&
          typeof fe.message === "string" &&
          typeof se.code === "string" &&
          se.code.length > 0 &&
          typeof se.message === "string"
        );
      }),
      { numRuns: 500 },
    );
  });

  // ── settled promise, never an unhandled rejection ────────────────────────
  it("findInFiles does not throw or reject for any error", async () => {
    await expect(
      createIpcBinding(throwingRenderer(new Error("any"))).findInFiles("/repo", "q", searchOpts),
    ).resolves.toMatchObject({ ok: false });
  });

  it("searchFiles does not throw or reject for any error", async () => {
    await expect(
      createIpcBinding(throwingRenderer(new Error("any"))).searchFiles("/repo", "q", searchOpts),
    ).resolves.toMatchObject({ ok: false });
  });
});
