import { z } from "zod";

/**
 * Settings are split by SCOPE, because the right value genuinely differs.
 *
 *   AppSettings  — follow the person across every knowledge base.
 *   KbSettings   — belong to one repository, keyed by its path on disk.
 *
 * Secrets are deliberately absent from both. The Anthropic API key and the
 * GitHub token live in a separate, OS-encrypted store (see the desktop app's
 * secretStore) and never travel through these objects: the renderer receives
 * only the SecretStatus summary below, never plaintext.
 *
 * Agent instructions are also absent. They are prose the team shares, so they
 * live in a committed ARLO.md at the repository root rather than in machine-
 * local config.
 */

// ── Enumerations ───────────────────────────────────────────────────────────

export const ThemeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

/** `system` follows the OS locale. */
export const InterfaceLanguageSchema = z.enum(["system", "en", "zh-Hant", "ja"]);
export type InterfaceLanguage = z.infer<typeof InterfaceLanguageSchema>;

/** `match-document` lets the agent infer from the file it is editing. */
export const WritingLanguageSchema = z.enum(["match-document", "en", "zh-Hant", "ja"]);
export type WritingLanguage = z.infer<typeof WritingLanguageSchema>;

export const StartupBehaviourSchema = z.enum([
  /** Reopen the last knowledge base and every draft that was open. */
  "restore-all",
  /** Reopen the knowledge base, but no drafts. */
  "restore-kb",
  /** Always show the start screen. */
  "start-screen",
]);
export type StartupBehaviour = z.infer<typeof StartupBehaviourSchema>;

export const OpenFilesInSchema = z.enum(["preview", "edit", "last-used"]);
export type OpenFilesIn = z.infer<typeof OpenFilesInSchema>;

export const FrontMatterModeSchema = z.enum(["hide", "table"]);
export type FrontMatterMode = z.infer<typeof FrontMatterModeSchema>;

export const AgentModelSchema = z.enum([
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
]);
export type AgentModel = z.infer<typeof AgentModelSchema>;

export const AgentAutonomySchema = z.enum([
  /** Every edit waits for explicit approval. */
  "review-each",
  /** Edits land in the worktree; the pull request is the gate. */
  "draft-freely",
  /** Edits and commits without asking. */
  "full",
]);
export type AgentAutonomy = z.infer<typeof AgentAutonomySchema>;

// ── Application scope ──────────────────────────────────────────────────────

export const AppSettingsSchema = z.object({
  general: z
    .object({
      // Defaults to "start-screen": the app asks which repository to open on
      // every launch. Each repo remembers its own worktrees in <repo>/.arlo/
      // (see the session schema), so "restore-all" / "restore-kb" stay useful
      // for anyone who wants the last one reopened automatically.
      startup: StartupBehaviourSchema.default("start-screen"),
      autoCheckUpdates: z.boolean().default(true),
      autoInstallUpdates: z.boolean().default(false),
    })
    .default({}),
  appearance: z
    .object({
      theme: ThemeSchema.default("system"),
      interfaceLanguage: InterfaceLanguageSchema.default("system"),
    })
    .default({}),
  editor: z
    .object({
      autosave: z.boolean().default(true),
      /** Debounce before an autosave fires. */
      autosaveDelayMs: z.number().int().min(200).max(10_000).default(800),
      openFilesIn: OpenFilesInSchema.default("preview"),
      frontMatter: FrontMatterModeSchema.default("hide"),
      /** Empty string means "use the platform mono stack". */
      fontFamily: z.string().max(120).default(""),
      fontSize: z.number().int().min(10).max(24).default(14),
      /**
       * Let the editor and the preview fill the pane they are given, so the
       * text follows the window and reflows when the chat panel opens. With
       * this off the column is held to `lineWidth` and centred.
       */
      fullWidth: z.boolean().default(true),
      /** Measure of the editor column, in characters. Ignored while fullWidth. */
      lineWidth: z.number().int().min(40).max(160).default(72),
      wrapLines: z.boolean().default(true),
      lineNumbers: z.boolean().default(false),
    })
    .default({}),
  agent: z
    .object({
      model: AgentModelSchema.default("claude-opus-5"),
      autonomy: AgentAutonomySchema.default("review-each"),
    })
    .default({}),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;

// ── Knowledge-base scope ───────────────────────────────────────────────────

export const GitIdentitySchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});
export type GitIdentity = z.infer<typeof GitIdentitySchema>;

/** Directory names excluded from search unless the user edits the list. */
export const DEFAULT_SEARCH_EXCLUDES = ["node_modules", ".git", "dist", "build"] as const;

export const DEFAULT_PR_TEMPLATE = `## What changed

{{summary}}

## Files

{{files}}
`;

export const KbSettingsSchema = z.object({
  repository: z
    .object({
      /** Branch new drafts fork from. */
      defaultBranch: z.string().min(1).max(255).default("main"),
      /** null means "inherit whatever git config resolves for this repo". */
      identityOverride: GitIdentitySchema.nullable().default(null),
      /** Add a Co-Authored-By trailer to commits the agent wrote. */
      markAgentCommits: z.boolean().default(true),
    })
    .default({}),
  publishing: z
    .object({
      /** Empty string falls back to repository.defaultBranch. */
      mergeInto: z.string().max(255).default(""),
      /** Let the agent draft the pull-request title and body from the diff. */
      agentDraftsPr: z.boolean().default(true),
      openAsDraft: z.boolean().default(false),
      prTemplate: z.string().max(20_000).default(DEFAULT_PR_TEMPLATE),
      deleteWorktreeAfterMerge: z.boolean().default(true),
    })
    .default({}),
  search: z
    .object({
      excludes: z.array(z.string().min(1).max(255)).max(200).default([...DEFAULT_SEARCH_EXCLUDES]),
      respectGitignore: z.boolean().default(true),
      includeHidden: z.boolean().default(false),
      /** Where Cmd+Shift+F starts; the modal still overrides per query. */
      caseSensitive: z.boolean().default(false),
      useRegex: z.boolean().default(false),
      maxResults: z.number().int().min(10).max(5_000).default(200),
    })
    .default({}),
  agent: z
    .object({
      writingLanguage: WritingLanguageSchema.default("match-document"),
    })
    .default({}),
});
export type KbSettings = z.infer<typeof KbSettingsSchema>;

// ── The settings file as a whole ───────────────────────────────────────────

/** Bumped only for changes a migration must handle. */
export const SETTINGS_VERSION = 1;

export const SettingsFileSchema = z.object({
  version: z.number().int().default(SETTINGS_VERSION),
  app: AppSettingsSchema.default({}),
  /** Keyed by absolute repository path. */
  kbs: z.record(z.string(), KbSettingsSchema).default({}),
});
export type SettingsFile = z.infer<typeof SettingsFileSchema>;

// ── What the renderer may know about secrets ───────────────────────────────

/**
 * Everything the renderer is allowed to learn about a stored secret. Note the
 * absence of the value itself: only the main process ever decrypts one, so a
 * compromised renderer cannot exfiltrate a key it was never handed.
 */
export const SecretStatusSchema = z.object({
  anthropic: z.object({
    isSet: z.boolean(),
    /** e.g. "sk-ant-****4f2a" — enough to recognise, not enough to use. */
    masked: z.string().nullable(),
    /** ISO-8601 timestamp of the last successful verification. */
    lastVerifiedAt: z.string().nullable(),
  }),
  github: z.object({
    isSet: z.boolean(),
    login: z.string().nullable(),
    scopes: z.array(z.string()),
  }),
});
export type SecretStatus = z.infer<typeof SecretStatusSchema>;

// ── Defaults ───────────────────────────────────────────────────────────────

/**
 * Defaults are FUNCTIONS, not constants, and callers must use them.
 *
 * A shared default object is a trap here: callers naturally treat a default as
 * a starting point and mutate it (`settings.appearance.theme = x`), which would
 * silently rewrite the default for every later caller in the process. Handing
 * out a fresh object each time removes that whole class of bug.
 *
 * The frozen constants below exist for read-only comparison. They are deeply
 * frozen so an accidental write throws in strict mode instead of corrupting
 * state invisibly.
 */
export function defaultAppSettings(): AppSettings {
  return AppSettingsSchema.parse({});
}

export function defaultKbSettings(): KbSettings {
  return KbSettingsSchema.parse({});
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

/** Read-only. To get something you can modify, call defaultAppSettings(). */
export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = deepFreeze(defaultAppSettings());
/** Read-only. To get something you can modify, call defaultKbSettings(). */
export const DEFAULT_KB_SETTINGS: Readonly<KbSettings> = deepFreeze(defaultKbSettings());
