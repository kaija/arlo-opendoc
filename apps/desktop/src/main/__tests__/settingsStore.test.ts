import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * settingsStore holds every preference the app has, is written on essentially
 * every toggle (settings apply instantly, with no Save button), and is a file
 * users are invited to open by hand via About > Reveal settings file.
 *
 * That combination means the two properties worth proving are about SURVIVAL
 * rather than happy-path round-tripping: a malformed file must cost the user
 * the malformed part and nothing else, and a partial write must merge rather
 * than clobber its neighbours.
 */

let currentTempDir = '';

vi.mock('electron', () => ({
  app: { getPath: (_name: string) => currentTempDir },
}));

const tempDirs: string[] = [];
let store: typeof import('../settingsStore.js');

async function seedSettingsFile(contents: string): Promise<void> {
  await writeFile(join(currentTempDir, 'settings.json'), contents, 'utf-8');
}

async function seedLegacyFile(contents: string): Promise<void> {
  await writeFile(join(currentTempDir, 'kiro-state.json'), contents, 'utf-8');
}

beforeEach(async () => {
  const dir = join(tmpdir(), `arlo-settings-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  currentTempDir = dir;
  tempDirs.push(dir);

  store = await import('../settingsStore.js');
  store.__resetCacheForTests();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('settingsStore — defaults', () => {
  it('returns schema defaults when no file exists', async () => {
    const app = await store.readApp();
    expect(app.appearance.theme).toBe('system');
    expect(app.general.startup).toBe('start-screen');
    expect(app.editor.autosave).toBe(true);
    expect(app.editor.autosaveDelayMs).toBe(800);
    expect(app.editor.openFilesIn).toBe('preview');
    expect(app.agent.autonomy).toBe('review-each');
    expect(app.agent.model).toBe('claude-opus-5');
  });

  it('returns defaults for a knowledge base that has never been configured', async () => {
    const kb = await store.readKb('/some/repo/never/seen');
    expect(kb.repository.defaultBranch).toBe('main');
    expect(kb.repository.identityOverride).toBeNull();
    expect(kb.search.excludes).toEqual(['node_modules', '.git', 'dist', 'build']);
    expect(kb.publishing.deleteWorktreeAfterMerge).toBe(true);
  });

  it('reading an unconfigured knowledge base does not write to disk', async () => {
    await store.readKb('/some/repo/never/seen');
    const raw = JSON.parse(await readFile(join(currentTempDir, 'settings.json'), 'utf-8'));
    // The file exists (first-run migration created it) but must hold no KB entry
    // merely because one was read.
    expect(raw.kbs).toEqual({});
  });
});

describe('settingsStore — corruption tolerance', () => {
  it('falls back to defaults when the file is not valid JSON', async () => {
    await seedSettingsFile('{ this is not json');
    const app = await store.readApp();
    expect(app.appearance.theme).toBe('system');
  });

  it('keeps valid knowledge-base entries when a sibling entry is malformed', async () => {
    await seedSettingsFile(
      JSON.stringify({
        version: 1,
        app: { appearance: { theme: 'dark' } },
        kbs: {
          '/good/repo': { repository: { defaultBranch: 'trunk' } },
          '/bad/repo': { repository: { defaultBranch: 42 } },
        },
      }),
    );

    // The good entry survives with its value…
    expect((await store.readKb('/good/repo')).repository.defaultBranch).toBe('trunk');
    // …the bad one is dropped back to defaults rather than taking the file down…
    expect((await store.readKb('/bad/repo')).repository.defaultBranch).toBe('main');
    // …and the app block is untouched by its neighbour's problem.
    expect((await store.readApp()).appearance.theme).toBe('dark');
  });

  it('salvages the app block when it is partially wrong', async () => {
    await seedSettingsFile(
      JSON.stringify({
        version: 1,
        app: { appearance: { theme: 'chartreuse' }, editor: { fontSize: 18 } },
        kbs: {},
      }),
    );
    const app = await store.readApp();
    // An invalid enum value costs that section, not the whole file.
    expect(['system', 'light', 'dark']).toContain(app.appearance.theme);
    expect(app.editor.fontSize).toBeTypeOf('number');
  });
});

describe('settingsStore — merge semantics', () => {
  it('a patch to one section leaves the others untouched', async () => {
    await store.writeApp({ editor: { fontSize: 18 } });
    await store.writeApp({ appearance: { theme: 'dark' } });

    const app = await store.readApp();
    expect(app.editor.fontSize).toBe(18);
    expect(app.appearance.theme).toBe('dark');
    // Fields the patches never mentioned keep their defaults.
    expect(app.editor.autosave).toBe(true);
    expect(app.general.startup).toBe('start-screen');
  });

  it('a patch to one field leaves the rest of that section untouched', async () => {
    await store.writeApp({ editor: { fontSize: 18, wrapLines: false } });
    await store.writeApp({ editor: { fontSize: 20 } });

    const app = await store.readApp();
    expect(app.editor.fontSize).toBe(20);
    expect(app.editor.wrapLines).toBe(false);
  });

  it('knowledge bases are isolated from one another', async () => {
    await store.writeKb('/repo/a', { repository: { defaultBranch: 'trunk' } });
    await store.writeKb('/repo/b', { repository: { defaultBranch: 'master' } });

    expect((await store.readKb('/repo/a')).repository.defaultBranch).toBe('trunk');
    expect((await store.readKb('/repo/b')).repository.defaultBranch).toBe('master');
  });

  it('rejects out-of-range values rather than persisting them', async () => {
    await expect(store.writeApp({ editor: { autosaveDelayMs: 5 } })).rejects.toThrow();
    // The bad write left nothing behind.
    expect((await store.readApp()).editor.autosaveDelayMs).toBe(800);
  });

  it('round-trips any valid font size and line width', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 24 }),
        fc.integer({ min: 40, max: 160 }),
        async (fontSize, lineWidth) => {
          await store.writeApp({ editor: { fontSize, lineWidth } });
          const app = await store.readApp();
          return app.editor.fontSize === fontSize && app.editor.lineWidth === lineWidth;
        },
      ),
      { numRuns: 25 },
    );
  });
});

describe('settingsStore — migration from the pre-settings build', () => {
  it('carries the theme across', async () => {
    await seedLegacyFile(JSON.stringify({ theme: 'dark', lastFolderPath: '/repo/a' }));
    expect((await store.readApp()).appearance.theme).toBe('dark');
  });

  it('re-homes the formerly global defaultBranch onto the last folder', async () => {
    await seedLegacyFile(
      JSON.stringify({ theme: 'light', defaultBranch: 'trunk', lastFolderPath: '/repo/a' }),
    );
    // defaultBranch was global in the old schema and is per-knowledge-base now,
    // so it must land on a specific repo rather than becoming everyone's default.
    expect((await store.readKb('/repo/a')).repository.defaultBranch).toBe('trunk');
    expect((await store.readKb('/repo/other')).repository.defaultBranch).toBe('main');
  });

  it('ignores a legacy defaultBranch with no folder to attach it to', async () => {
    await seedLegacyFile(JSON.stringify({ defaultBranch: 'trunk' }));
    await store.readApp();
    const raw = JSON.parse(await readFile(join(currentTempDir, 'settings.json'), 'utf-8'));
    expect(raw.kbs).toEqual({});
  });

  it('survives an unreadable legacy file', async () => {
    await seedLegacyFile('not json at all');
    expect((await store.readApp()).appearance.theme).toBe('system');
  });
});

describe('settingsStore — reset', () => {
  it('restores defaults across both scopes', async () => {
    await store.writeApp({ appearance: { theme: 'dark' } });
    await store.writeKb('/repo/a', { repository: { defaultBranch: 'trunk' } });

    await store.resetPreferences();

    expect((await store.readApp()).appearance.theme).toBe('system');
    expect((await store.readKb('/repo/a')).repository.defaultBranch).toBe('main');
  });
});
