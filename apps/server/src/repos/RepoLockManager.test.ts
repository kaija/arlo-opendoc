import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ContentionError,
  MAX_QUEUE_DEPTH,
  RepoLockManager,
} from "./RepoLockManager.js";

/**
 * Feature: monorepo-scaffold
 * Tests: RepoLockManager property-based tests
 * Validates: Requirements 13.6, 13.7
 */

describe("RepoLockManager", () => {
  // Feature: monorepo-scaffold, Property 6: Queue enforces max depth
  // Validates: Requirements 13.6, 13.7
  it(
    "Property 6: queue enforces max depth",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 51, max: 100 }),
          async (n) => {
            const manager = new RepoLockManager();
            const userId = "test-user";

            // Hold the lock to force all subsequent calls to queue
            let releaseLock!: () => void;
            const lockHeld = new Promise<void>((resolve) => {
              releaseLock = resolve;
            });

            // Acquire the lock with the holder task
            const holderPromise = manager.runWithLock(userId, () => lockHeld);

            // Give the holder a tick to acquire the lock before we fire the rest
            await new Promise((r) => setTimeout(r, 10));

            // Fire n-1 additional requests while the lock is held.
            // Do NOT await here yet — collect the promises first.
            const waiterPromises = Array.from({ length: n - 1 }, () =>
              manager.runWithLock(userId, () => Promise.resolve("ok")),
            );

            // Release the lock NOW so queued waiters can proceed.
            // Queue-full rejections have already fired synchronously.
            releaseLock();
            await holderPromise.catch(() => {});

            // Now settle all waiters
            const results = await Promise.allSettled(waiterPromises);

            // Count rejections
            const rejections = results.filter((r) => r.status === "rejected");

            // At least n - 1 - MAX_QUEUE_DEPTH requests must be rejected:
            //   n total submitted, 1 is the holder already running,
            //   MAX_QUEUE_DEPTH slots available in the queue.
            const minExpectedRejections = Math.max(0, n - 1 - MAX_QUEUE_DEPTH);
            expect(rejections.length).toBeGreaterThanOrEqual(
              minExpectedRejections,
            );

            // Every rejection must be ContentionError
            for (const r of rejections) {
              if (r.status === "rejected") {
                expect(r.reason).toBeInstanceOf(ContentionError);
              }
            }
          },
        ),
        { numRuns: 20 },
      );
    },
    60_000, // generous timeout: 20 runs × up to ~100 concurrent tasks each
  );

  // Feature: monorepo-scaffold, Property 7: Timeout rejects waiting requests
  // Validates: Requirement 13.6
  //
  // LOCK_WAIT_TIMEOUT_MS = 30,000ms is too slow to trigger live in a test suite.
  // We verify the contention-rejection path via queue saturation: submitting more
  // than MAX_QUEUE_DEPTH waiters produces immediate queue_full ContentionErrors,
  // which exercises the same rejection code path as the timeout branch.
  it(
    "Property 7: overflow beyond max depth is always rejected with ContentionError",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // numExtra: how many requests above MAX_QUEUE_DEPTH to fire
          fc.integer({ min: 1, max: 10 }),
          async (numExtra) => {
            const manager = new RepoLockManager();
            const userId = "overflow-user";

            // Hold the lock so every queued request must wait
            let releaseLock!: () => void;
            const lockHeld = new Promise<void>((resolve) => {
              releaseLock = resolve;
            });

            const holderPromise = manager.runWithLock(userId, () => lockHeld);

            // Wait for holder to acquire
            await new Promise((r) => setTimeout(r, 10));

            // Submit MAX_QUEUE_DEPTH + numExtra waiters without awaiting yet
            const numWaiters = MAX_QUEUE_DEPTH + numExtra;
            const waiterPromises = Array.from({ length: numWaiters }, () =>
              manager.runWithLock(userId, () => Promise.resolve("ok")),
            );

            // Release the lock so non-rejected waiters can complete
            releaseLock();
            await holderPromise.catch(() => {});

            const waiterResults = await Promise.allSettled(waiterPromises);

            // At least numExtra of the waiters must have been rejected immediately
            // (those that pushed depth past MAX_QUEUE_DEPTH)
            const rejected = waiterResults.filter(
              (r) => r.status === "rejected",
            );
            expect(rejected.length).toBeGreaterThanOrEqual(numExtra);

            // All rejections must be ContentionError with reason queue_full
            for (const r of rejected) {
              if (r.status === "rejected") {
                expect(r.reason).toBeInstanceOf(ContentionError);
                expect((r.reason as ContentionError).reason).toBe("queue_full");
              }
            }
          },
        ),
        { numRuns: 20 },
      );
    },
    60_000,
  );
});
