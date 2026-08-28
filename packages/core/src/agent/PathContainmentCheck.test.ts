import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { resolve as pathResolve, sep } from "node:path";
import { checkContainment, ContainmentError } from "./PathContainmentCheck.js";

/**
 * Feature: monorepo-scaffold
 * Tests: PathContainmentCheck property-based tests
 * Validates: Requirements 6.1–6.6
 */

// Fixed absolute root for deterministic results across platforms
const FIXED_ROOT = "/tmp/kbroot";

describe("PathContainmentCheck", () => {
  // Feature: monorepo-scaffold, Property 1: Trailing-separator independence
  // Validates: Requirement 6.1
  it("Property 1: trailing-separator independence", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter((s) => !s.includes("\0")),
        (subPath) => {
          const target = `${FIXED_ROOT}/${subPath}`;

          let resultWithSlash: string | null = null;
          let errorWithSlash: unknown = null;
          try {
            resultWithSlash = checkContainment(FIXED_ROOT + "/", target);
          } catch (e) {
            errorWithSlash = e;
          }

          let resultWithoutSlash: string | null = null;
          let errorWithoutSlash: unknown = null;
          try {
            resultWithoutSlash = checkContainment(FIXED_ROOT, target);
          } catch (e) {
            errorWithoutSlash = e;
          }

          // Both calls must produce the same outcome
          if (errorWithSlash !== null || errorWithoutSlash !== null) {
            // If either threw, both must throw ContainmentError
            expect(errorWithSlash).toBeInstanceOf(ContainmentError);
            expect(errorWithoutSlash).toBeInstanceOf(ContainmentError);
          } else {
            // If both succeeded, they must return the same canonical path
            expect(resultWithSlash).toEqual(resultWithoutSlash);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monorepo-scaffold, Property 2: Path traversal always rejected
  // Validates: Requirements 6.2, 6.3
  it("Property 2: path traversal always rejected", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Classic traversal attempts
          fc.constant(`${FIXED_ROOT}/../etc/passwd`),
          fc.constant(`${FIXED_ROOT}/../../etc/shadow`),
          // kbRoot itself (not strictly inside)
          fc.constant(FIXED_ROOT),
          // Sibling directory
          fc.constant("/tmp/sibling/file.md"),
          // Prefix collision — not a child, just shares the prefix
          fc.constant(`${FIXED_ROOT}evil/file.md`),
          // Arbitrary strings that might resolve anywhere
          fc
            .string({ minLength: 0, maxLength: 100 })
            .filter((s) => !s.includes("\0")),
        ),
        (badTarget) => {
          // Resolve the candidate; if it falls inside FIXED_ROOT, skip
          let canon: string;
          try {
            canon = pathResolve(badTarget);
          } catch {
            // Unreachable for plain strings, but guard anyway
            return;
          }

          if (canon.startsWith(FIXED_ROOT + sep)) {
            // This candidate is legitimately inside the root — skip it
            return;
          }

          // Every path that is not strictly inside FIXED_ROOT must be rejected
          expect(() => checkContainment(FIXED_ROOT, badTarget)).toThrow(
            ContainmentError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monorepo-scaffold, Property 3: Valid paths returned canonicalized
  // Validates: Requirement 6.4
  it("Property 3: valid paths returned canonicalized", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 50 })
          .filter(
            (s) =>
              !s.includes("\0") &&
              !s.includes("..") &&
              s.trim().length > 0,
          ),
        (subPath) => {
          const target = `${FIXED_ROOT}/${subPath}`;
          const expected = pathResolve(target);

          // Only apply the property when the resolved path is genuinely inside root
          if (!expected.startsWith(FIXED_ROOT + sep)) return;

          const result = checkContainment(FIXED_ROOT, target);
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: monorepo-scaffold, Property 4: No unhandled exceptions
  // Validates: Requirement 6.6
  it("Property 4: no unhandled exceptions for arbitrary inputs", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 0, maxLength: 200 })
          .filter((s) => !s.includes("\0")),
        fc
          .string({ minLength: 0, maxLength: 200 })
          .filter((s) => !s.includes("\0")),
        (kbRoot, targetPath) => {
          try {
            const result = checkContainment(kbRoot, targetPath);
            // Success path must return a string
            expect(typeof result).toBe("string");
          } catch (err) {
            // Failure path must only ever throw ContainmentError
            expect(err).toBeInstanceOf(ContainmentError);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
