import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { RepoSession } from '@arlo-doc/shared';
import {
  readRepoSession,
  writeRepoSession,
  summariseRecentRepos,
} from '../repoSessionStore.js';

/**
 * repoSessionStore owns `<repo>/.arlo/session.json` — the per-repository record
 * of open draft worktrees. The properties worth proving mirror persistenceStore's:
 * a missing/corrupt file yields an empty session (never an error), worktree
 * entries whose directory has vanished are pruned on read, and the file is
 * gitignored after a write.
 */

const tempDirs: string[] = [];

async function makeRepo(): Promise<string> {
  const dir = join(tmpdir(), `arlo-reposession-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  tempDirs.push(dir);
  return dir;
}

/** A worktree directory that actually exists on disk, under the repo. */
async function makeWorktree(repo: string, name: string): Promise<string> {
  const path = join(repo, '.arlo', 'worktrees', name);
  await mkdir(path, { recursive: true });
  return path;
}

beforeEach(() => {
  tempDirs.length = 0;
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('repoSessionStore', () => {
  it('returns an empty session when no file exists', async () => {
    const repo = await makeRepo();
    const session = await readRepoSession(repo);
    expect(session.worktrees).toEqual([]);
    expect(session.activeTabId).toBeNull();
    expect(session.repoPath).toBe(repo);
  });

  it('round-trips worktrees and the active tab, stamping updatedAt and repoPath', async () => {
    const repo = await makeRepo();
    const wtPath = await makeWorktree(repo, 'wt-1');

    const input: RepoSession = {
      version: 1,
      repoPath: '/stale/path/from/another/machine',
      activeTabId: 'draft',
      updatedAt: null,
      worktrees: [
        { id: 'main', title: 'my-repo', worktreePath: repo, branch: 'main', isMainTab: true },
        { id: 'draft', title: 'Untitled', worktreePath: wtPath, branch: 'wt-1' },
      ],
    };
    await writeRepoSession(repo, input);

    const out = await readRepoSession(repo);
    expect(out.worktrees.map((w) => w.id)).toEqual(['main', 'draft']);
    expect(out.activeTabId).toBe('draft');
    // repoPath is corrected to the real location, not whatever was written.
    expect(out.repoPath).toBe(repo);
    expect(typeof out.updatedAt).toBe('string');
  });

  it('gitignores the session file after a write', async () => {
    const repo = await makeRepo();
    await writeRepoSession(repo, {
      version: 1,
      repoPath: repo,
      activeTabId: null,
      updatedAt: null,
      worktrees: [],
    });
    const gitignore = await readFile(join(repo, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.arlo/session.json');
  });

  it('prunes worktrees whose directory has vanished and repairs the active tab', async () => {
    const repo = await makeRepo();
    const kept = await makeWorktree(repo, 'wt-kept');

    await writeRepoSession(repo, {
      version: 1,
      repoPath: repo,
      activeTabId: 'gone',
      updatedAt: null,
      worktrees: [
        { id: 'kept', title: 'Kept', worktreePath: kept, branch: 'wt-kept' },
        {
          id: 'gone',
          title: 'Gone',
          worktreePath: join(repo, '.arlo', 'worktrees', 'wt-gone'),
          branch: 'wt-gone',
        },
      ],
    });

    const out = await readRepoSession(repo);
    expect(out.worktrees.map((w) => w.id)).toEqual(['kept']);
    // activeTabId pointed at the pruned entry → falls back to the survivor.
    expect(out.activeTabId).toBe('kept');
  });

  it('returns an empty session when the file is not valid JSON', async () => {
    const repo = await makeRepo();
    await mkdir(join(repo, '.arlo'), { recursive: true });
    await writeFile(join(repo, '.arlo', 'session.json'), '{ not json', 'utf-8');

    const out = await readRepoSession(repo);
    expect(out.worktrees).toEqual([]);
  });

  it('summarises recent repos, counting only draft worktrees and dropping missing dirs', async () => {
    const repoA = await makeRepo();
    const wt1 = await makeWorktree(repoA, 'wt-1');
    const wt2 = await makeWorktree(repoA, 'wt-2');
    await writeRepoSession(repoA, {
      version: 1,
      repoPath: repoA,
      activeTabId: null,
      updatedAt: null,
      worktrees: [
        { id: 'main', title: 'A', worktreePath: repoA, branch: 'main', isMainTab: true },
        { id: 'd1', title: 'Draft 1', worktreePath: wt1, branch: 'wt-1' },
        { id: 'd2', title: 'Draft 2', worktreePath: wt2, branch: 'wt-2' },
      ],
    });

    const repoB = await makeRepo(); // opened once, no session file yet
    const missing = join(tmpdir(), `arlo-reposession-missing-${randomUUID()}`);

    const summaries = await summariseRecentRepos([repoA, repoB, missing]);
    expect(summaries.map((s) => s.path)).toEqual([repoA, repoB]);

    const a = summaries.find((s) => s.path === repoA)!;
    expect(a.worktreeCount).toBe(2); // main tab excluded
    expect(a.name).toBe(repoA.split('/').pop());
    expect(typeof a.lastOpenedAt).toBe('string');

    const b = summaries.find((s) => s.path === repoB)!;
    expect(b.worktreeCount).toBe(0);
    expect(b.lastOpenedAt).toBeNull();
  });
});
