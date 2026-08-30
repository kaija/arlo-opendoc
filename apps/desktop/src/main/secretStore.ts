import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { app, safeStorage } from "electron";
import type { SecretStatus } from "@arlo-doc/shared";

/**
 * OS-encrypted storage for the two secrets the app holds: the Anthropic API
 * key and the GitHub token.
 *
 * WHY THIS IS SEPARATE FROM settingsStore
 * ---------------------------------------
 * Settings round-trip to the renderer constantly. Secrets must not. Every
 * function here that returns a plaintext value is main-process only; the sole
 * renderer-facing shape is `status()`, which reports whether a secret exists
 * and enough of it to recognise — never enough to use. A compromised renderer
 * (a malicious markdown render, a bad dependency) therefore cannot exfiltrate
 * a key it is never handed.
 *
 * ENCRYPTION
 * ----------
 * safeStorage is backed by the macOS Keychain and Windows DPAPI, ships with
 * Electron, and needs no native module. It is only available after the app is
 * ready, so every entry point here loads lazily rather than at import time.
 *
 * If the OS declines to provide encryption, we REFUSE TO WRITE rather than
 * silently falling back to plaintext on disk. A key the user believes is in
 * their keychain must not quietly become a file anyone can read.
 */

interface SecretsFile {
  version: number;
  /** base64 of the safeStorage ciphertext, or absent when unset. */
  anthropicApiKey?: string;
  githubToken?: string;
  /** Non-secret metadata about the secrets, kept alongside them. */
  meta?: {
    anthropicLastVerifiedAt?: string;
    githubLogin?: string;
    githubScopes?: string[];
  };
}

const SECRETS_VERSION = 1;

function secretsPath(): string {
  return join(app.getPath("userData"), "secrets.json");
}

let cache: SecretsFile | null = null;

async function load(): Promise<SecretsFile> {
  if (cache !== null) return cache;
  try {
    const raw = JSON.parse(await fs.readFile(secretsPath(), "utf-8")) as SecretsFile;
    cache = typeof raw === "object" && raw !== null ? raw : { version: SECRETS_VERSION };
  } catch {
    cache = { version: SECRETS_VERSION };
  }
  return cache;
}

async function persist(file: SecretsFile): Promise<void> {
  const target = secretsPath();
  const temp = join(dirname(target), `secrets.json.${process.pid}.tmp`);
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(file, null, 2), "utf-8");
  await fs.rename(temp, target);
  // Best effort: keep the file readable only by its owner. On Windows this is
  // a no-op, where DPAPI already scopes decryption to the user account.
  try {
    await fs.chmod(target, 0o600);
  } catch {
    // Non-fatal — the contents are ciphertext regardless.
  }
}

/** True when the OS will actually encrypt for us. */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "This system does not offer encrypted storage, so Arlo Doc will not save your key. " +
        "It would have to be written in plain text.",
    );
  }
  return safeStorage.encryptString(value).toString("base64");
}

function decrypt(blob: string | undefined): string | null {
  if (blob === undefined) return null;
  try {
    return safeStorage.decryptString(Buffer.from(blob, "base64"));
  } catch {
    // Written by a different OS user, a different machine, or after a keychain
    // reset. Treat as absent — the user can re-enter it.
    return null;
  }
}

/** Shows enough of a key to recognise it, never enough to use it. */
function mask(value: string): string {
  const tail = value.slice(-4);
  const prefix = value.startsWith("sk-ant-") ? "sk-ant-" : "";
  return `${prefix}${"•".repeat(16)}${tail}`;
}

// ── Renderer-facing ────────────────────────────────────────────────────────

/** The ONLY secret-derived shape the renderer ever receives. */
export async function status(): Promise<SecretStatus> {
  const file = await load();
  const anthropic = decrypt(file.anthropicApiKey);
  const github = decrypt(file.githubToken);
  return {
    anthropic: {
      isSet: anthropic !== null,
      masked: anthropic !== null ? mask(anthropic) : null,
      lastVerifiedAt: file.meta?.anthropicLastVerifiedAt ?? null,
    },
    github: {
      isSet: github !== null,
      login: file.meta?.githubLogin ?? null,
      scopes: file.meta?.githubScopes ?? [],
    },
  };
}

// ── Main-process only ──────────────────────────────────────────────────────

/** Plaintext accessor. Must never be reachable from an IPC handler. */
export async function getAnthropicKey(): Promise<string | null> {
  return decrypt((await load()).anthropicApiKey);
}

/** Plaintext accessor. Must never be reachable from an IPC handler. */
export async function getGithubToken(): Promise<string | null> {
  return decrypt((await load()).githubToken);
}

// ── Mutation ───────────────────────────────────────────────────────────────

export async function setAnthropicKey(value: string): Promise<SecretStatus> {
  const file = await load();
  const trimmed = value.trim();
  if (trimmed === "") return clearAnthropicKey();
  file.anthropicApiKey = encrypt(trimmed);
  // A newly stored key is unverified until it is actually checked.
  delete file.meta?.anthropicLastVerifiedAt;
  await persist(file);
  return status();
}

export async function markAnthropicVerified(at: string): Promise<SecretStatus> {
  const file = await load();
  file.meta = { ...file.meta, anthropicLastVerifiedAt: at };
  await persist(file);
  return status();
}

export async function clearAnthropicKey(): Promise<SecretStatus> {
  const file = await load();
  delete file.anthropicApiKey;
  delete file.meta?.anthropicLastVerifiedAt;
  await persist(file);
  return status();
}

export async function setGithubToken(
  token: string,
  login: string,
  scopes: string[],
): Promise<SecretStatus> {
  const file = await load();
  file.githubToken = encrypt(token);
  file.meta = { ...file.meta, githubLogin: login, githubScopes: scopes };
  await persist(file);
  return status();
}

export async function clearGithubToken(): Promise<SecretStatus> {
  const file = await load();
  delete file.githubToken;
  delete file.meta?.githubLogin;
  delete file.meta?.githubScopes;
  await persist(file);
  return status();
}

/**
 * Removes every stored credential. Backs About > "Sign out and forget
 * credentials", which is deliberately separate from resetting preferences.
 */
export async function forgetAll(): Promise<SecretStatus> {
  cache = { version: SECRETS_VERSION };
  await persist(cache);
  return status();
}

/** Test seam: drops the in-memory cache so the next read hits disk. */
export function __resetCacheForTests(): void {
  cache = null;
}
