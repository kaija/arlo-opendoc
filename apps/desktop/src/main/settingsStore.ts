import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { app } from "electron";
import {
  AppSettingsSchema,
  KbSettingsSchema,
  SettingsFileSchema,
  SETTINGS_VERSION,
  defaultAppSettings,
  defaultKbSettings,
  type AppSettings,
  type KbSettings,
  type SettingsFile,
} from "@arlo-doc/shared";

/**
 * Reads and writes settings.json in the Electron userData directory.
 *
 * Two properties this module guarantees, both of which matter because settings
 * apply instantly and are written on nearly every interaction:
 *
 *   1. A corrupt or partial file never bricks the app. Anything unparseable is
 *      replaced by defaults rather than thrown, and a single bad knowledge-base
 *      entry is dropped without taking the rest of the file with it.
 *   2. Writes are atomic. We write to a sibling temp file and rename, so a
 *      crash mid-write cannot leave a half-written JSON document behind.
 *
 * Secrets are NOT here — see secretStore.ts.
 */

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

/** The pre-settings persistence file, still the home of tab/session state. */
function legacyStatePath(): string {
  return join(app.getPath("userData"), "kiro-state.json");
}

// ── In-memory cache ────────────────────────────────────────────────────────
// Settings are read on nearly every IPC call and written on every toggle, so
// the file is loaded once and kept in memory. All mutation goes through
// update(), which keeps the cache and the file in step.

let cache: SettingsFile | null = null;

function fallback(): SettingsFile {
  return { version: SETTINGS_VERSION, app: defaultAppSettings(), kbs: {} };
}

/**
 * Parses raw JSON into a SettingsFile, salvaging whatever is valid.
 *
 * Deliberately lenient: a user who hand-edits the file (About > Reveal
 * settings file) and makes one mistake should lose that one field, not every
 * preference they have ever set.
 */
function coerce(raw: unknown): SettingsFile {
  const whole = SettingsFileSchema.safeParse(raw);
  if (whole.success) return whole.data;

  // Whole-file parse failed. Salvage the app block and each KB entry
  // independently so one bad key cannot discard the rest.
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const appParsed = AppSettingsSchema.safeParse(obj.app);
  const appSettings = appParsed.success ? appParsed.data : defaultAppSettings();

  const kbs: Record<string, KbSettings> = {};
  const rawKbs = typeof obj.kbs === "object" && obj.kbs !== null ? obj.kbs : {};
  for (const [path, value] of Object.entries(rawKbs as Record<string, unknown>)) {
    const parsed = KbSettingsSchema.safeParse(value);
    if (parsed.success) kbs[path] = parsed.data;
  }

  return { version: SETTINGS_VERSION, app: appSettings, kbs };
}

/**
 * Carries forward the handful of preferences the pre-settings build stored.
 *
 * kiro-state.json keeps session state (last folder, open worktrees) and is
 * left in place — this only lifts anything that is genuinely a preference.
 * Older builds wrote a flat UserSettings shape; only `theme` and
 * `defaultBranch` from it have a home in the new schema, and defaultBranch was
 * global then but is per-knowledge-base now, so it is applied to the last
 * folder rather than silently dropped or wrongly globalised.
 */
async function migrateFromLegacy(): Promise<SettingsFile> {
  const migrated = fallback();
  try {
    const text = await fs.readFile(legacyStatePath(), "utf-8");
    const legacy = JSON.parse(text) as {
      theme?: unknown;
      defaultBranch?: unknown;
      lastFolderPath?: unknown;
    };

    const theme = ThemeFromLegacy(legacy.theme);
    if (theme !== null) migrated.app.appearance.theme = theme;

    if (
      typeof legacy.defaultBranch === "string" &&
      legacy.defaultBranch.length > 0 &&
      typeof legacy.lastFolderPath === "string" &&
      legacy.lastFolderPath.length > 0
    ) {
      const kb = defaultKbSettings();
      kb.repository.defaultBranch = legacy.defaultBranch;
      migrated.kbs[legacy.lastFolderPath] = kb;
    }
  } catch {
    // No legacy file, or it is unreadable. Defaults are the right answer.
  }
  return migrated;
}

function ThemeFromLegacy(value: unknown): AppSettings["appearance"]["theme"] | null {
  return value === "light" || value === "dark" || value === "system" ? value : null;
}

// ── Read ───────────────────────────────────────────────────────────────────

/** Loads settings from disk once, then serves them from memory. */
export async function load(): Promise<SettingsFile> {
  if (cache !== null) return cache;

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(settingsPath(), "utf-8"));
  } catch {
    // First run, or the file is gone. Try to carry the old build's
    // preferences over before falling back to defaults.
    cache = await migrateFromLegacy();
    await persist(cache);
    return cache;
  }

  cache = coerce(raw);
  return cache;
}

export async function readApp(): Promise<AppSettings> {
  return (await load()).app;
}

/**
 * Returns the settings for one knowledge base, defaulted if it has never been
 * configured. Never writes — reading a repository for the first time should
 * not dirty the settings file.
 */
export async function readKb(repoPath: string): Promise<KbSettings> {
  const file = await load();
  return file.kbs[repoPath] ?? defaultKbSettings();
}

// ── Write ──────────────────────────────────────────────────────────────────

async function persist(file: SettingsFile): Promise<void> {
  const target = settingsPath();
  const temp = join(dirname(target), `settings.json.${process.pid}.tmp`);
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(temp, JSON.stringify(file, null, 2), "utf-8");
  // rename is atomic within a filesystem, so a reader never sees a partial file.
  await fs.rename(temp, target);
}

/**
 * Merges a partial patch into the application settings.
 *
 * The merge is one level deep per section, which matches how the UI writes:
 * a control changes one field of one section, and the rest of that section
 * must survive. The result is re-validated so an out-of-range value from a
 * buggy caller cannot be persisted.
 */
export async function writeApp(patch: DeepPartial<AppSettings>): Promise<AppSettings> {
  const file = await load();
  const merged = {
    general: { ...file.app.general, ...(patch.general ?? {}) },
    appearance: { ...file.app.appearance, ...(patch.appearance ?? {}) },
    editor: { ...file.app.editor, ...(patch.editor ?? {}) },
    agent: { ...file.app.agent, ...(patch.agent ?? {}) },
  };
  const parsed = AppSettingsSchema.parse(merged);
  file.app = parsed;
  await persist(file);
  return parsed;
}

export async function writeKb(
  repoPath: string,
  patch: DeepPartial<KbSettings>,
): Promise<KbSettings> {
  const file = await load();
  const current = file.kbs[repoPath] ?? defaultKbSettings();
  const merged = {
    repository: { ...current.repository, ...(patch.repository ?? {}) },
    publishing: { ...current.publishing, ...(patch.publishing ?? {}) },
    search: { ...current.search, ...(patch.search ?? {}) },
    agent: { ...current.agent, ...(patch.agent ?? {}) },
  };
  const parsed = KbSettingsSchema.parse(merged);
  file.kbs[repoPath] = parsed;
  await persist(file);
  return parsed;
}

/**
 * Restores default preferences. Knowledge-base entries go too, since they are
 * preferences as well — but secrets are untouched, which is why About offers
 * "reset preferences" and "forget credentials" as two separate actions.
 */
export async function resetPreferences(): Promise<SettingsFile> {
  cache = fallback();
  await persist(cache);
  return cache;
}

/** Absolute path of the settings file, for About > Reveal settings file. */
export function getSettingsPath(): string {
  return settingsPath();
}

/** Test seam: drops the in-memory cache so the next read hits disk. */
export function __resetCacheForTests(): void {
  cache = null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };
