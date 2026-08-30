import { describe, it, expect } from 'vitest';
import { reconcileIgnoreContent } from '../worktreeLayout';

/**
 * The migration hazard this guards: worktrees moved from .arlo/ down into
 * .arlo/worktrees/, and the ignore rule narrowed to match. If narrowing simply
 * replaced `.arlo/` with `.arlo/worktrees/`, every worktree an older build
 * created at `.arlo/wt-*` would become untracked files a user could commit by
 * accident — a whole checked-out tree landing in a pull request.
 *
 * So the invariant is: after reconciliation, BOTH locations are ignored.
 */

function ignores(content: string, path: string): boolean {
  const lines = content.split('\n').map((l) => l.trim());
  if (path.startsWith('.arlo/worktrees/')) {
    return lines.includes('.arlo/worktrees/') || lines.includes('.arlo/worktrees');
  }
  if (/^\.arlo\/wt-/.test(path)) {
    return lines.includes('.arlo/wt-*/') || lines.includes('.arlo/wt-*') || lines.includes('.arlo/');
  }
  if (path === '.arlo/session.json') {
    return lines.includes('.arlo/session.json') || lines.includes('.arlo/');
  }
  return false;
}

describe('worktree .gitignore reconciliation', () => {
  it('creates every entry in an empty .gitignore', () => {
    const next = reconcileIgnoreContent('');
    expect(next).not.toBeNull();
    expect(ignores(next!, '.arlo/worktrees/wt-1')).toBe(true);
    expect(ignores(next!, '.arlo/wt-1')).toBe(true);
    expect(ignores(next!, '.arlo/session.json')).toBe(true);
  });

  it('replaces the over-broad .arlo/ entry but keeps legacy worktrees ignored', () => {
    const next = reconcileIgnoreContent('node_modules/\n.arlo/\ndist/\n');
    expect(next).not.toBeNull();
    // The broad entry is gone…
    expect(next!.split('\n').map((l) => l.trim())).not.toContain('.arlo/');
    // …but nothing it used to cover became visible.
    expect(ignores(next!, '.arlo/worktrees/wt-1')).toBe(true);
    expect(ignores(next!, '.arlo/wt-1756')).toBe(true);
    expect(ignores(next!, '.arlo/session.json')).toBe(true);
  });

  it('preserves unrelated entries and their order', () => {
    const next = reconcileIgnoreContent('node_modules/\n.arlo/\ndist/\n*.log\n');
    const lines = next!.split('\n').filter((l) => l.trim() !== '');
    expect(lines.slice(0, 3)).toEqual(['node_modules/', 'dist/', '*.log']);
  });

  it('is a no-op once every entry is present', () => {
    const settled = '.arlo/worktrees/\n.arlo/wt-*/\n.arlo/session.json\n';
    expect(reconcileIgnoreContent(settled)).toBeNull();
  });

  it('adds the session entry to a file that only ignores the worktrees', () => {
    const next = reconcileIgnoreContent('.arlo/worktrees/\n.arlo/wt-*/\n');
    expect(next).not.toBeNull();
    expect(ignores(next!, '.arlo/session.json')).toBe(true);
    // and does not disturb what was already correct
    expect(ignores(next!, '.arlo/worktrees/wt-1')).toBe(true);
    expect(ignores(next!, '.arlo/wt-1')).toBe(true);
  });

  it('is idempotent — reconciling twice changes nothing the second time', () => {
    const once = reconcileIgnoreContent('node_modules/\n.arlo/\n');
    expect(once).not.toBeNull();
    expect(reconcileIgnoreContent(once!)).toBeNull();
  });

  it('adds a missing entry without duplicating the one already there', () => {
    const next = reconcileIgnoreContent('.arlo/worktrees/\n');
    expect(next).not.toBeNull();
    const occurrences = next!.split('\n').filter((l) => l.trim() === '.arlo/worktrees/').length;
    expect(occurrences).toBe(1);
    expect(ignores(next!, '.arlo/wt-1')).toBe(true);
  });

  it('does not lose a trailing entry when the file has no final newline', () => {
    const next = reconcileIgnoreContent('node_modules/\ndist/');
    expect(next!.split('\n').map((l) => l.trim())).toContain('dist/');
    expect(ignores(next!, '.arlo/worktrees/wt-1')).toBe(true);
  });

  it('leaves a .gitignore that never mentioned .arlo otherwise intact', () => {
    const next = reconcileIgnoreContent('*.log\n');
    expect(next!.startsWith('*.log\n')).toBe(true);
  });
});
