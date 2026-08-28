/**
 * Feature: folder-browser
 * Task 5.5 — CP-006: IPC KbResult contract (REQ-002.8)
 *
 * Verifies that every folder-browser IPC handler, when its underlying
 * operation throws, causes `makeInvoke` to produce a structured
 * `{ ok: false, error: { code, message } }` result — never an unhandled
 * rejection or a bare string.
 *
 * We test at the client binding layer: inject a mock `ipcRenderer.invoke`
 * that throws various error shapes, then assert the returned `KbResult`.
 *
 * Validates: Requirements REQ-002.8
 */

import { describe, it, expect } from 'vitest';
import { createIpcBinding } from '@arlo-doc/client/ipc';
import type { ElectronIpcRenderer } from '@arlo-doc/client/ipc';
import type { KbResult } from '@arlo-doc/client';

// ── helpers ────────────────────────────────────────────────────────────────

/** Build an Error that carries a `.kbError` payload, matching what the main-
 *  process handlers attach before rethrowing (see index.ts wrapError / inline
 *  error wrapping in the readFolder / readFile handlers). */
function makeKbError(code: string, message: string): Error & { kbError: unknown } {
  const err = new Error(message) as Error & { kbError: unknown };
  err.kbError = { code, message };
  return err;
}

/** An ipcRenderer whose `invoke` always throws the supplied error. */
function throwingRenderer(error: unknown): ElectronIpcRenderer {
  return {
    invoke: () => Promise.reject(error),
  };
}

/** Narrow a KbResult to the failure branch and return the error object. */
function expectFailure(result: KbResult<unknown>): { code: string; message: string } {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('unreachable'); // type narrowing only
  const { code, message } = result.error;
  expect(typeof code).toBe('string');
  expect(code.length).toBeGreaterThan(0);
  expect(typeof message).toBe('string');
  return { code, message };
}

// ── test matrix ────────────────────────────────────────────────────────────

type HandlerCall = (binding: ReturnType<typeof createIpcBinding>) => Promise<KbResult<unknown>>;

const handlers: Array<{ name: string; call: HandlerCall }> = [
  {
    name: 'chooseFolder',
    call: (b) => b.chooseFolder() as Promise<KbResult<unknown>>,
  },
  {
    name: 'readFolder',
    call: (b) => b.readFolder('/some/path') as Promise<KbResult<unknown>>,
  },
  {
    name: 'getLastFolder',
    call: (b) => b.getLastFolder() as Promise<KbResult<unknown>>,
  },
  {
    name: 'readFile',
    call: (b) => b.readFile('/some/file.md') as Promise<KbResult<unknown>>,
  },
];

// ── tests ──────────────────────────────────────────────────────────────────

describe('CP-006: IPC KbResult contract — folder-browser handlers (REQ-002.8)', () => {
  // ── ENOENT / NOT_FOUND ──────────────────────────────────────────────────
  describe('when ipcRenderer throws a NOT_FOUND kbError (ENOENT)', () => {
    for (const handler of handlers) {
      it(`${handler.name} → { ok: false, error: { code: 'NOT_FOUND', ... } }`, async () => {
        const renderer = throwingRenderer(
          makeKbError('NOT_FOUND', 'no such file or directory'),
        );
        const binding = createIpcBinding(renderer);
        const result = await handler.call(binding);

        const { code } = expectFailure(result);
        expect(code).toBe('NOT_FOUND');
      });
    }
  });

  // ── EACCES / PERMISSION_DENIED ──────────────────────────────────────────
  describe('when ipcRenderer throws a PERMISSION_DENIED kbError (EACCES)', () => {
    for (const handler of handlers) {
      it(`${handler.name} → { ok: false, error: { code: 'PERMISSION_DENIED', ... } }`, async () => {
        const renderer = throwingRenderer(
          makeKbError('PERMISSION_DENIED', 'permission denied'),
        );
        const binding = createIpcBinding(renderer);
        const result = await handler.call(binding);

        const { code } = expectFailure(result);
        expect(code).toBe('PERMISSION_DENIED');
      });
    }
  });

  // ── plain Error (no kbError) → UNKNOWN ──────────────────────────────────
  describe('when ipcRenderer throws a plain Error (no kbError property)', () => {
    for (const handler of handlers) {
      it(`${handler.name} → { ok: false, error: { code: 'UNKNOWN', ... } }`, async () => {
        const renderer = throwingRenderer(new Error('something went wrong'));
        const binding = createIpcBinding(renderer);
        const result = await handler.call(binding);

        const { code, message } = expectFailure(result);
        expect(code).toBe('UNKNOWN');
        expect(message).toBe('something went wrong');
      });
    }
  });

  // ── non-Error throw (bare string) → UNKNOWN ────────────────────────────
  describe('when ipcRenderer rejects with a non-Error value', () => {
    for (const handler of handlers) {
      it(`${handler.name} with bare string → { ok: false, error: { code: 'UNKNOWN', ... } }`, async () => {
        const renderer = throwingRenderer('unexpected raw string rejection');
        const binding = createIpcBinding(renderer);
        const result = await handler.call(binding);

        const { code } = expectFailure(result);
        expect(code).toBe('UNKNOWN');
      });
    }
  });

  // ── result is never an unhandled rejection ──────────────────────────────
  describe('result is always a settled KbResult, never an unhandled rejection', () => {
    for (const handler of handlers) {
      it(`${handler.name} does not throw or reject`, async () => {
        const renderer = throwingRenderer(new Error('any error'));
        const binding = createIpcBinding(renderer);

        // If makeInvoke leaked the rejection, this await would throw.
        // The test would fail with an unhandled promise rejection.
        await expect(handler.call(binding)).resolves.toMatchObject({ ok: false });
      });
    }
  });
});
