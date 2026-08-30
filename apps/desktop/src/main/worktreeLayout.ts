import { promises as fs } from "node:fs";
import { join } from "node:path";

/**
 * Where worktrees live inside a repository, and how that location is ignored.
 *
 * Worktrees used to be created at `<repo>/.arlo/wt-<ts>`, with `.arlo/` added
 * wholesale to .gitignore. That made `.arlo/` unusable for anything the team
 * should share, so worktrees moved down a level into `.arlo/worktrees/` and the
 * ignore rule narrowed to match.
 *
 * The narrowing is the dangerous half. A repository created by an older build
 * still has worktrees sitting at `.arlo/wt-*`, and simply replacing `.arlo/`
 * with `.arlo/worktrees/` would un-ignore them — turning an entire checked-out
 * worktree into untracked files a user could accidentally commit. So the legacy
 * pattern is always written alongside the new one, and existing worktrees are
 * left exactly where they are rather than being moved out from under git.
 */

export const WORKTREES_DIR = join(".arlo", "worktrees");

/** Current location. */
const IGNORE_CURRENT = ".arlo/worktrees/";
/** Covers worktrees created by builds that placed them directly in .arlo/. */
const IGNORE_LEGACY = ".arlo/wt-*/";

/** Ignore entries that mean "the whole .arlo directory" and are now too broad. */
const OVERBROAD = new Set([".arlo", ".arlo/"]);

export function worktreesRoot(repoRoot: string): string {
  return join(repoRoot, WORKTREES_DIR);
}

/**
 * Rewrites .gitignore so both the current and legacy worktree locations are
 * ignored, and drops the over-broad `.arlo/` entry if an older build left one.
 *
 * Returns the resulting file content, or null when nothing needed changing.
 * Never throws: failing to update .gitignore must not block creating a draft.
 */
export function reconcileIgnoreContent(content: string): string | null {
  const lines = content.split("\n");
  const trimmed = lines.map((l) => l.trim());

  const hadOverbroad = trimmed.some((l) => OVERBROAD.has(l));
  const hasCurrent = trimmed.includes(IGNORE_CURRENT) || trimmed.includes(".arlo/worktrees");
  const hasLegacy = trimmed.includes(IGNORE_LEGACY) || trimmed.includes(".arlo/wt-*");

  if (!hadOverbroad && hasCurrent && hasLegacy) return null;

  // Drop the over-broad entry; keep everything else in place.
  const kept = lines.filter((l) => !OVERBROAD.has(l.trim()));

  const additions: string[] = [];
  if (!hasCurrent) additions.push(IGNORE_CURRENT);
  if (!hasLegacy) additions.push(IGNORE_LEGACY);

  if (additions.length === 0 && !hadOverbroad) return null;

  let next = kept.join("\n");
  if (additions.length > 0) {
    if (next !== "" && !next.endsWith("\n")) next += "\n";
    next += additions.join("\n") + "\n";
  }
  return next;
}

/** Applies reconcileIgnoreContent to the repository's .gitignore. */
export async function ensureWorktreesIgnored(repoRoot: string): Promise<void> {
  const gitignorePath = join(repoRoot, ".gitignore");
  try {
    let content = "";
    try {
      content = await fs.readFile(gitignorePath, "utf-8");
    } catch {
      // No .gitignore yet — one will be created.
    }
    const next = reconcileIgnoreContent(content);
    if (next !== null) await fs.writeFile(gitignorePath, next, "utf-8");
  } catch {
    // Non-fatal: a draft is still perfectly usable with a stale .gitignore.
  }
}
