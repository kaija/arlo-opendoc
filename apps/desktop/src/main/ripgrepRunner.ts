import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { app } from "electron";
import type { ContentMatch, ContentMatchLine, SearchOptions } from "@arlo-doc/shared";
import type { KbResult } from "@arlo-doc/client";

// ── Constants ──────────────────────────────────────────────────────────────

export const DEFAULT_EXCLUDES = ["node_modules", ".git", "dist", "build"] as const;

const TIMEOUT_MS = 30_000;
/** Fallback cap when the caller supplies no maxResults. */
const MAX_FILES = 20;
const MAX_MATCH_LINES = 100; // across all files

// ── Internal rg --json types (NOT exported) ────────────────────────────────

interface RgPath {
  text: string;
}

interface RgMatchLine {
  type: "match";
  data: {
    path: RgPath;
    lines: { text: string };
    line_number: number;
    submatches: unknown[];
  };
}

interface RgContextLine {
  type: "context";
  data: {
    path: RgPath;
    lines: { text: string };
    line_number: number;
  };
}

// ── Type guards (REQ-012.3) ────────────────────────────────────────────────

function isRgMatch(obj: unknown): obj is RgMatchLine {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (o["type"] !== "match") return false;
  const data = o["data"];
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d["line_number"] === "number" &&
    typeof d["path"] === "object" &&
    d["path"] !== null &&
    typeof (d["path"] as Record<string, unknown>)["text"] === "string" &&
    typeof d["lines"] === "object" &&
    d["lines"] !== null &&
    typeof (d["lines"] as Record<string, unknown>)["text"] === "string"
  );
}

function isRgContext(obj: unknown): obj is RgContextLine {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (o["type"] !== "context") return false;
  const data = o["data"];
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d["line_number"] === "number" &&
    typeof d["path"] === "object" &&
    d["path"] !== null &&
    typeof (d["path"] as Record<string, unknown>)["text"] === "string" &&
    typeof d["lines"] === "object" &&
    d["lines"] !== null &&
    typeof (d["lines"] as Record<string, unknown>)["text"] === "string"
  );
}

// ── NDJSON parser ──────────────────────────────────────────────────────────

/**
 * Parses rg --json NDJSON output into ContentMatch[].
 *
 * Truncates to `maxFiles` files and MAX_MATCH_LINES total match lines
 * (REQ-004.6). The file cap is a parameter because it is user-configurable in
 * Settings > Search & index; the match-line cap stays fixed, since it protects
 * the renderer rather than expressing a preference.
 */
function parseRgOutput(stdout: string, maxFiles: number = MAX_FILES): ContentMatch[] {
  const results: ContentMatch[] = [];
  // Map from filePath → index in results[], for fast lookup during accumulation
  const fileIndex = new Map<string, number>();
  let totalMatchLines = 0;

  for (const rawLine of stdout.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Early-exit once both caps are hit
    if (results.length >= maxFiles && totalMatchLines >= MAX_MATCH_LINES) break;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      // Skip malformed NDJSON lines
      continue;
    }

    if (isRgMatch(parsed)) {
      // Stop adding to new files once the file cap is reached
      const filePath = parsed.data.path.text;
      let idx = fileIndex.get(filePath);
      if (idx === undefined) {
        if (results.length >= maxFiles) continue;
        idx = results.length;
        results.push({ filePath, lines: [] });
        fileIndex.set(filePath, idx);
      }

      // Stop adding match lines once MAX_MATCH_LINES is reached
      if (totalMatchLines >= MAX_MATCH_LINES) continue;

      const entry = results[idx];
      if (entry === undefined) continue;

      const line: ContentMatchLine = {
        lineNumber: parsed.data.line_number,
        text: parsed.data.lines.text.replace(/\n$/, ""),
        isMatch: true,
      };
      entry.lines.push(line);
      totalMatchLines++;
    } else if (isRgContext(parsed)) {
      const filePath = parsed.data.path.text;
      const idx = fileIndex.get(filePath);
      // Only append context lines to files we're already tracking
      if (idx === undefined) continue;

      const entry = results[idx];
      if (entry === undefined) continue;

      const line: ContentMatchLine = {
        lineNumber: parsed.data.line_number,
        text: parsed.data.lines.text.replace(/\n$/, ""),
        isMatch: false,
      };
      entry.lines.push(line);
    }
    // "begin", "end", "summary" lines are intentionally ignored
  }

  return results;
}

// ── Binary resolution (REQ-005.1–2) ───────────────────────────────────────

/**
 * Resolves the ripgrep binary path.
 * - Uses RG_PATH env var when set (no fallback).
 * - Falls back to the platform-specific bundled path inside the Electron app bundle.
 */
export function resolveRgBinary(): string {
  if (process.env["RG_PATH"]) return process.env["RG_PATH"];
  const base = app.getAppPath();
  return process.platform === "win32"
    ? join(base, "bin", "rg.exe")
    : join(base, "bin", "rg");
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Runs ripgrep against repoDir and returns structured ContentMatch results.
 *
 * REQ-004.3–5: fixed rg flags + conditional --ignore-case / --fixed-strings
 * REQ-005.1–2: binary resolution + NOT_FOUND on missing binary
 * REQ-005.4: minimal { PATH } environment
 * REQ-005.5: 30-second timeout with SIGTERM + TIMEOUT error
 * REQ-004.6: truncation to 20 files / 100 match lines
 * REQ-004.10–11: exit-code handling
 */
export async function findInFiles(
  repoDir: string,
  query: string,
  options: SearchOptions,
): Promise<KbResult<ContentMatch[]>> {
  // ── Binary resolution ────────────────────────────────────────────────────
  const rgPath = resolveRgBinary();

  try {
    await fs.access(rgPath);
  } catch {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `ripgrep binary not found at ${rgPath}`,
      },
    };
  }

  // ── Validate repoDir ─────────────────────────────────────────────────────
  try {
    await fs.access(repoDir);
  } catch {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `repo directory not found: ${repoDir}`,
      },
    };
  }

  // ── Build rg arguments ───────────────────────────────────────────────────
  // REQ-004.3: --json, --context 2, --max-count 5, --glob '!{...}'
  // Exclusions come from the knowledge base's settings when the caller has
  // them; DEFAULT_EXCLUDES is the fallback so a caller without settings still
  // does not walk node_modules.
  const excludes =
    options.excludes !== undefined && options.excludes.length > 0
      ? options.excludes
      : [...DEFAULT_EXCLUDES];

  const args: string[] = [
    "--json",
    "--context",
    "2",
    "--max-count",
    "5",
    `--glob=!{${excludes.join(",")}}`,
  ];

  // rg respects .gitignore by default; --no-ignore-vcs turns that off.
  if (options.respectGitignore === false) {
    args.push("--no-ignore-vcs");
  }

  // rg skips dot-prefixed entries by default.
  if (options.includeHidden === true) {
    args.push("--hidden");
  }

  // REQ-004.4: --ignore-case when caseSensitive is false
  if (!options.caseSensitive) {
    args.push("--ignore-case");
  }

  // REQ-004.5: --fixed-strings when useRegex is false
  if (!options.useRegex) {
    args.push("--fixed-strings");
  }

  args.push(query);

  // ── Spawn rg ─────────────────────────────────────────────────────────────
  return new Promise<KbResult<ContentMatch[]>>((resolve) => {
    const child = spawn(rgPath, args, {
      cwd: repoDir,
      // REQ-005.4: minimal environment — only PATH from the parent
      env: { PATH: process.env["PATH"] ?? "" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    // REQ-005.5: 30-second timeout
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        ok: false,
        error: {
          code: "TIMEOUT",
          message: "ripgrep timed out after 30 seconds",
        },
      });
    }, TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        // Success — parse output
        resolve({ ok: true, data: parseRgOutput(stdout, options.maxResults ?? MAX_FILES) });
      } else if (code === 1) {
        // REQ-004.10: exit code 1 = no matches (not an error)
        resolve({ ok: true, data: [] });
      } else {
        // REQ-004.11: any other exit code = UNKNOWN error
        resolve({
          ok: false,
          error: {
            code: "UNKNOWN",
            message: stderr.trim() || `ripgrep exited with code ${String(code)}`,
          },
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        error: {
          code: "UNKNOWN",
          message: err.message,
        },
      });
    });
  });
}
