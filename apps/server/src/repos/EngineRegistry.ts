import type { CoreEngine } from "@arlo-doc/core";
import { RepoLockManager } from "./RepoLockManager.js";

export interface EngineRegistryConfig {
  /** Idle timeout in milliseconds. Valid range: 60_000–86_400_000 (1–1440 minutes). */
  idleTimeoutMs: number;
}

interface EngineEntry {
  engine: CoreEngine;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Maintains a registry of active CoreEngine instances keyed by user ID.
 * Handles lazy construction, idle eviction, and working directory cleanup.
 * Requirements 13.1–13.4
 */
export class EngineRegistry {
  private readonly entries = new Map<string, EngineEntry>();
  private readonly pendingRelease = new Set<string>();
  private readonly lockManager = new RepoLockManager();
  private readonly config: EngineRegistryConfig;

  constructor(config: EngineRegistryConfig) {
    const MIN_MS = 60_000;     // 1 minute
    const MAX_MS = 86_400_000; // 1440 minutes
    if (config.idleTimeoutMs < MIN_MS || config.idleTimeoutMs > MAX_MS) {
      throw new RangeError(
        `idleTimeoutMs must be between ${MIN_MS} and ${MAX_MS} ` +
          `(${MIN_MS / 60_000}–${MAX_MS / 60_000} minutes), ` +
          `got ${config.idleTimeoutMs}`,
      );
    }
    this.config = config;
  }

  /**
   * Returns the existing CoreEngine for userId (resetting the idle timer),
   * or creates a new one via factory() if none exists.
   *
   * Requirements 13.1, 13.2
   */
  async getOrCreate(
    userId: string,
    factory: () => Promise<CoreEngine>,
  ): Promise<CoreEngine> {
    const existing = this.entries.get(userId);
    if (existing !== undefined) {
      this.resetIdleTimer(userId, existing);
      return existing.engine;
    }

    const engine = await factory();
    const timer = this.scheduleEviction(userId);
    this.entries.set(userId, { engine, timer });
    return engine;
  }

  /**
   * Evicts the engine for userId: clears the idle timer, removes the registry
   * entry, and calls releaseWorkdir. On failure, logs the error and marks the
   * userId for a subsequent cleanup attempt.
   *
   * Requirements 13.3, 13.4
   */
  evict(userId: string): void {
    const entry = this.entries.get(userId);
    if (entry === undefined) return;

    clearTimeout(entry.timer);
    this.entries.delete(userId);

    void this.releaseWorkdir(userId).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[EngineRegistry] Failed to release workdir for user "${userId}": ${message}. ` +
          `Marking for retry.`,
      );
      this.pendingRelease.add(userId);
    });
  }

  /**
   * Returns the shared RepoLockManager used by all route handlers.
   */
  getLockManager(): RepoLockManager {
    return this.lockManager;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private scheduleEviction(userId: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      this.evict(userId);
    }, this.config.idleTimeoutMs);
  }

  private resetIdleTimer(userId: string, entry: EngineEntry): void {
    clearTimeout(entry.timer);
    entry.timer = this.scheduleEviction(userId);
  }

  /**
   * Stub: releases the working directory for the given user.
   * Populated in Phase 4 — removes the server-side git clone directory.
   *
   * Requirement 13.4
   */
  private async releaseWorkdir(_userId: string): Promise<void> {
    // Phase 4: clean up the cloned working directory from the filesystem
  }
}
