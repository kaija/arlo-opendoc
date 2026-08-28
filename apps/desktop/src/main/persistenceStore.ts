import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

interface KiroState {
  lastFolderPath?: string | null;
}

function statePath(): string {
  return join(app.getPath('userData'), 'kiro-state.json');
}

export async function getLastFolder(): Promise<string | null> {
  try {
    const raw = await fs.readFile(statePath(), 'utf-8');
    const parsed = JSON.parse(raw) as KiroState;
    return typeof parsed.lastFolderPath === 'string' ? parsed.lastFolderPath : null;
  } catch {
    // File not found, invalid JSON, or any other error: return null silently
    return null;
  }
}

export async function saveLastFolder(folderPath: string | null): Promise<void> {
  const stateFile = statePath();
  const tmpFile = stateFile + '.tmp';
  try {
    // Merge with existing state to preserve other keys
    let existing: KiroState = {};
    try {
      const raw = await fs.readFile(stateFile, 'utf-8');
      existing = JSON.parse(raw) as KiroState;
    } catch {
      // File absent or corrupt — start fresh
    }
    const next: KiroState = { ...existing, lastFolderPath: folderPath };
    await fs.writeFile(tmpFile, JSON.stringify(next, null, 2), 'utf-8');
    await fs.rename(tmpFile, stateFile); // atomic on all supported platforms
  } catch (err) {
    // Write failure must not surface to the user (REQ-007.1)
    console.error('[PersistenceStore] Failed to save state:', err);
    try { await fs.unlink(tmpFile); } catch { /* ignore cleanup error */ }
  }
}
