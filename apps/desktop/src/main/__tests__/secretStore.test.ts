import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * The security claim this module makes is narrow and testable: the renderer is
 * handed a status object, never a key. These tests pin that claim down, plus
 * the two failure modes that would otherwise be silent — refusing to write when
 * the OS offers no encryption, and treating an undecryptable blob as absent
 * rather than crashing.
 *
 * safeStorage is faked with a reversible transform. That is enough to prove the
 * store never writes plaintext and never leaks a value through status(); it
 * deliberately proves nothing about the strength of the real OS encryption,
 * which is Electron's job, not ours.
 */

let currentTempDir = '';
let encryptionAvailable = true;

/** Marks the payload so a plaintext leak into the file is unmistakable. */
const FAKE_PREFIX = 'enc::';

vi.mock('electron', () => ({
  app: { getPath: (_name: string) => currentTempDir },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    encryptString: (plain: string) => Buffer.from(FAKE_PREFIX + plain, 'utf-8'),
    decryptString: (buf: Buffer) => {
      const text = buf.toString('utf-8');
      if (!text.startsWith(FAKE_PREFIX)) throw new Error('cannot decrypt');
      return text.slice(FAKE_PREFIX.length);
    },
  },
}));

const tempDirs: string[] = [];
let store: typeof import('../secretStore.js');

const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789-4f2a';

async function rawFile(): Promise<string> {
  return readFile(join(currentTempDir, 'secrets.json'), 'utf-8');
}

beforeEach(async () => {
  const dir = join(tmpdir(), `arlo-secret-test-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  currentTempDir = dir;
  encryptionAvailable = true;
  tempDirs.push(dir);

  store = await import('../secretStore.js');
  store.__resetCacheForTests();
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('secretStore — the renderer never receives a key', () => {
  it('status() reports presence without the value', async () => {
    await store.setAnthropicKey(KEY);
    const status = await store.status();

    expect(status.anthropic.isSet).toBe(true);
    expect(JSON.stringify(status)).not.toContain(KEY);
  });

  it('the masked form leaks only the last four characters', async () => {
    await store.setAnthropicKey(KEY);
    const { masked } = (await store.status()).anthropic;

    expect(masked).not.toBeNull();
    expect(masked).toContain(KEY.slice(-4));
    // Nothing beyond the recognisable prefix and that tail.
    expect(masked).not.toContain(KEY.slice(0, 20));
    expect(masked!.length).toBeLessThan(KEY.length);
  });

  it('no status object ever contains the stored key, for any key shape', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 8, maxLength: 120 }), async (secret) => {
        store.__resetCacheForTests();
        await store.setAnthropicKey(secret);
        const serialised = JSON.stringify(await store.status());
        return !serialised.includes(secret.trim());
      }),
      { numRuns: 30 },
    );
  });
});

describe('secretStore — what reaches disk', () => {
  it('writes ciphertext, never the plaintext key', async () => {
    await store.setAnthropicKey(KEY);
    const onDisk = await rawFile();

    expect(onDisk).not.toContain(KEY);
    // …but the value is genuinely recoverable in the main process.
    expect(await store.getAnthropicKey()).toBe(KEY);
  });

  it('refuses to store anything when the OS offers no encryption', async () => {
    encryptionAvailable = false;
    await expect(store.setAnthropicKey(KEY)).rejects.toThrow(/plain text/i);
    expect((await store.status()).anthropic.isSet).toBe(false);
  });

  it('treats an undecryptable blob as absent instead of throwing', async () => {
    await store.setAnthropicKey(KEY);
    // Simulate a keychain reset or a copy from another machine.
    store.__resetCacheForTests();
    await rm(join(currentTempDir, 'secrets.json'));
    await mkdir(currentTempDir, { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(
      join(currentTempDir, 'secrets.json'),
      JSON.stringify({ version: 1, anthropicApiKey: Buffer.from('garbage').toString('base64') }),
      'utf-8',
    );

    const status = await store.status();
    expect(status.anthropic.isSet).toBe(false);
    expect(status.anthropic.masked).toBeNull();
  });
});

describe('secretStore — lifecycle', () => {
  it('an empty key clears rather than storing an empty secret', async () => {
    await store.setAnthropicKey(KEY);
    await store.setAnthropicKey('   ');
    expect((await store.status()).anthropic.isSet).toBe(false);
  });

  it('storing a new key resets its verified timestamp', async () => {
    await store.setAnthropicKey(KEY);
    await store.markAnthropicVerified('2026-08-30T00:00:00.000Z');
    expect((await store.status()).anthropic.lastVerifiedAt).toBe('2026-08-30T00:00:00.000Z');

    await store.setAnthropicKey('sk-ant-something-else-9999');
    // A replaced key has not been checked yet, and must not inherit the old
    // key's "Verified" badge.
    expect((await store.status()).anthropic.lastVerifiedAt).toBeNull();
  });

  it('forgetAll removes both credentials', async () => {
    await store.setAnthropicKey(KEY);
    await store.setGithubToken('gho_token', 'kaija', ['repo', 'workflow']);
    expect((await store.status()).github.login).toBe('kaija');

    await store.forgetAll();

    const status = await store.status();
    expect(status.anthropic.isSet).toBe(false);
    expect(status.github.isSet).toBe(false);
    expect(status.github.login).toBeNull();
    expect(status.github.scopes).toEqual([]);
    expect(await rawFile()).not.toContain('gho_token');
  });

  it('clearing GitHub drops its metadata too', async () => {
    await store.setGithubToken('gho_token', 'kaija', ['repo']);
    await store.clearGithubToken();

    const status = await store.status();
    expect(status.github.isSet).toBe(false);
    expect(status.github.login).toBeNull();
    expect(status.github.scopes).toEqual([]);
  });
});
