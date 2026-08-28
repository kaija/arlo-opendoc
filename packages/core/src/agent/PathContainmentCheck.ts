import { resolve, sep } from "node:path";

export class ContainmentError extends Error {
  constructor(
    public readonly target: string,
    public readonly kbRoot: string,
  ) {
    super(
      `Path "${target}" is not contained within KB root "${kbRoot}". ` +
        `Write rejected.`,
    );
    this.name = "ContainmentError";
  }
}

/**
 * Validates that `targetPath` resolves to a location strictly inside `kbRoot`.
 *
 * Rules enforced:
 *  1. kbRoot is normalised by stripping any trailing path separator.
 *  2. targetPath is canonicalised with path.resolve.
 *  3. The canonicalised path must begin with normalised kbRoot + sep.
 *     The target may NOT be kbRoot itself (only files inside it are valid).
 *  4. Returns the canonicalised path on success.
 *  5. Throws ContainmentError on any violation.
 *  6. Never throws any other exception for any string input.
 *
 * Requirements: 6.1–6.6
 *
 * @throws {ContainmentError} if targetPath is not strictly inside kbRoot, for any input.
 */
export function checkContainment(kbRoot: string, targetPath: string): string {
  try {
    // Rule 1: strip trailing separator(s)
    const normRoot = kbRoot.replace(/[/\\]+$/, "");

    // Rule 2: canonicalise target
    const canonTarget = resolve(targetPath);

    // Rule 3: require strict containment — kbRoot itself is rejected
    const prefix = normRoot + sep;
    if (!canonTarget.startsWith(prefix)) {
      throw new ContainmentError(canonTarget, normRoot);
    }

    // Rule 4: return canonicalised path
    return canonTarget;
  } catch (err) {
    // Rule 6: re-throw only ContainmentError; wrap anything unexpected
    if (err instanceof ContainmentError) throw err;
    throw new ContainmentError(String(targetPath), String(kbRoot));
  }
}
