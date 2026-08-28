import { Mutex, withTimeout, E_TIMEOUT, type MutexInterface } from "async-mutex";

export const MAX_QUEUE_DEPTH = 50;
export const LOCK_WAIT_TIMEOUT_MS = 30_000;

export class ContentionError extends Error {
  constructor(
    public readonly userId: string,
    public readonly reason: "queue_full" | "timeout",
  ) {
    super(
      reason === "queue_full"
        ? `Too many concurrent requests for user "${userId}" — queue is full (max ${MAX_QUEUE_DEPTH})`
        : `Lock wait timeout exceeded for user "${userId}" after ${LOCK_WAIT_TIMEOUT_MS}ms`,
    );
    this.name = "ContentionError";
  }
}

/**
 * Per-user advisory lock manager.
 * Enforces a max queue depth of 50 and a 30 s wait timeout per Requirements 13.5–13.7.
 */
export class RepoLockManager {
  private readonly locks = new Map<string, MutexInterface>();
  private readonly queueDepths = new Map<string, number>();

  private getLock(userId: string): MutexInterface {
    let lock = this.locks.get(userId);
    if (lock === undefined) {
      lock = withTimeout(
        new Mutex(),
        LOCK_WAIT_TIMEOUT_MS,
        new ContentionError(userId, "timeout"),
      );
      this.locks.set(userId, lock);
    }
    return lock;
  }

  async runWithLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const depth = this.queueDepths.get(userId) ?? 0;

    // Requirement 13.6: reject immediately when queue is at capacity
    if (depth >= MAX_QUEUE_DEPTH) {
      throw new ContentionError(userId, "queue_full");
    }

    // Increment queue depth before acquiring the lock
    this.queueDepths.set(userId, depth + 1);

    try {
      return await this.getLock(userId).runExclusive(fn);
    } catch (err) {
      // Translate E_TIMEOUT sentinel to a typed ContentionError
      if (err === E_TIMEOUT) {
        throw new ContentionError(userId, "timeout");
      }
      throw err;
    } finally {
      // Always decrement depth whether fn succeeded, failed, or timed out
      const current = this.queueDepths.get(userId) ?? 1;
      this.queueDepths.set(userId, current - 1);
    }
  }
}
