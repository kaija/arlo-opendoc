import type { FileNode, FileNameMatch, SearchOptions } from "@arlo-doc/shared";

const MAX_RESULTS = 50;

// ─── Flatten ─────────────────────────────────────────────────────────────────

/**
 * Recursively collect all leaf (file) nodes from a FileNode tree.
 * Returns an array of FileNameMatch records, one per file.
 */
export function flattenLeaves(tree: FileNode): FileNameMatch[] {
  const results: FileNameMatch[] = [];
  collectLeaves(tree, results);
  return results;
}

function collectLeaves(node: FileNode, out: FileNameMatch[]): void {
  if (node.kind === "file") {
    out.push({ filePath: node.path, fileName: node.name });
    return;
  }
  for (const child of node.children) {
    collectLeaves(child, out);
  }
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Score a base name against a query string.
 *
 * Tiers (higher = better match):
 *   1. Exact prefix       → 1000 + queryLength
 *   2. Consecutive run    → 500  + runLength   (all query chars as a contiguous substring)
 *   3. Word-boundary      → 200  + boundaryCount  (query chars at word-boundary positions)
 *   4. Fuzzy              → 100  − gapPenalty  (all chars present in order, scattered)
 *   No match              → null
 *
 * Case: when caseSensitive=false, both sides are lowercased before comparison.
 * Regex: handled upstream in matchFileNames; this function always receives a plain query.
 */
export function scoreFileName(
  query: string,
  baseName: string,
  options: SearchOptions,
): number | null {
  if (!query) return null;

  const q = options.caseSensitive ? query : query.toLowerCase();
  const b = options.caseSensitive ? baseName : baseName.toLowerCase();

  // Tier 1: exact prefix
  if (b.startsWith(q)) {
    return 1000 + q.length;
  }

  // Tier 2: all query chars as a contiguous substring
  if (b.includes(q)) {
    return 500 + q.length;
  }

  // Tier 3: word-boundary match
  // Word boundaries: start of string, after `_`, `-`, `.`, and at lower→upper transitions
  const boundaryScore = wordBoundaryScore(q, b);
  if (boundaryScore !== null) {
    return 200 + boundaryScore;
  }

  // Tier 4: fuzzy — all query chars present in order
  const gapPenalty = fuzzyGap(q, b);
  if (gapPenalty !== null) {
    return 100 - gapPenalty;
  }

  return null;
}

/**
 * Try to match each query char at a word-boundary position in baseName.
 * Returns number of boundary matches if ALL query chars can be matched this way,
 * or null if not all chars can be placed at boundaries.
 */
function wordBoundaryScore(query: string, baseName: string): number | null {
  // Collect boundary positions in baseName
  const boundaries: number[] = [];
  for (let i = 0; i < baseName.length; i++) {
    if (isBoundaryPosition(baseName, i)) {
      boundaries.push(i);
    }
  }

  // Try to greedily match all query chars to boundary positions in order
  let qi = 0;
  for (const pos of boundaries) {
    if (qi >= query.length) break;
    if (baseName[pos] === query[qi]) {
      qi++;
    }
  }

  if (qi === query.length) {
    return qi; // all query chars matched at boundaries
  }
  return null;
}

/**
 * A position is a word boundary if it is:
 * - index 0 (start of string)
 * - preceded by `_`, `-`, or `.`
 * - a lowercase→uppercase transition (the uppercase char is the boundary)
 */
function isBoundaryPosition(s: string, i: number): boolean {
  if (i === 0) return true;
  const prev = s[i - 1]!;
  if (prev === "_" || prev === "-" || prev === ".") return true;
  // camelCase / PascalCase boundary: previous char is lowercase, current is uppercase
  if (prev === prev.toLowerCase() && prev !== prev.toUpperCase() &&
      s[i] === s[i]!.toUpperCase() && s[i] !== s[i]!.toLowerCase()) {
    return true;
  }
  return false;
}

/**
 * Fuzzy match: check all query chars appear in order in baseName.
 * Returns the gap penalty (number of skipped chars in baseName), or null if no match.
 */
function fuzzyGap(query: string, baseName: string): number | null {
  let qi = 0;
  for (let bi = 0; bi < baseName.length && qi < query.length; bi++) {
    if (baseName[bi] === query[qi]) {
      qi++;
    }
  }
  if (qi < query.length) return null; // not all query chars found
  // gap penalty = baseName length minus query length (rough measure of gaps)
  return baseName.length - query.length;
}

// ─── Match result type ────────────────────────────────────────────────────────

export type MatchResult =
  | FileNameMatch[]
  | { ok: false; error: "INVALID_REGEX" };

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Match a query against all file leaves in a FileNode tree.
 *
 * Returns up to MAX_RESULTS (50) FileNameMatch entries ordered by:
 *   1. Score descending (higher = better)
 *   2. filePath ascending (alphabetical) for ties
 *
 * When useRegex=true and the pattern is syntactically invalid, returns
 * `{ ok: false, error: 'INVALID_REGEX' }` instead of a FileNameMatch array.
 *
 * When query is empty or tree is null/has no leaves, returns [].
 */
export function matchFileNames(
  query: string,
  tree: FileNode | null,
  options: SearchOptions,
): MatchResult {
  if (!query || !tree) return [];

  const leaves = flattenLeaves(tree);
  if (leaves.length === 0) return [];

  // ── Regex mode ───────────────────────────────────────────────────────────
  if (options.useRegex) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(query, options.caseSensitive ? "" : "i");
    } catch {
      return { ok: false, error: "INVALID_REGEX" };
    }

    const matched = leaves
      .filter((leaf) => pattern.test(leaf.fileName))
      .sort((a, b) => a.filePath.localeCompare(b.filePath));

    return matched.slice(0, MAX_RESULTS);
  }

  // ── Normal / fuzzy mode ──────────────────────────────────────────────────
  type Scored = { match: FileNameMatch; score: number };
  const scored: Scored[] = [];

  for (const leaf of leaves) {
    const score = scoreFileName(query, leaf.fileName, options);
    if (score !== null) {
      scored.push({ match: leaf, score });
    }
  }

  // Sort: descending score, then ascending filePath
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.match.filePath.localeCompare(b.match.filePath);
  });

  return scored.slice(0, MAX_RESULTS).map((s) => s.match);
}
