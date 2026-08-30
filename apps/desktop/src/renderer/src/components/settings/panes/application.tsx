import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { PaneDef } from '../paneTypes';
import {
  Button,
  PendingBadge,
  NumberField,
  RadioGroup,
  ReadOnlyRow,
  Select,
  Slider,
  StatusLine,
  TextField,
  Toggle,
} from '../fields';

const MODEL_OPTIONS = [
  {
    value: 'claude-opus-5' as const,
    label: 'Most capable',
    hint: 'Best for long documents and multi-file edits.',
    trailing: <ModelId id="claude-opus-5" />,
  },
  {
    value: 'claude-sonnet-5' as const,
    label: 'Balanced',
    hint: 'Everyday editing.',
    trailing: <ModelId id="claude-sonnet-5" />,
  },
  {
    value: 'claude-haiku-4-5-20251001' as const,
    label: 'Fastest',
    hint: 'Quick lookups and small changes.',
    trailing: <ModelId id="claude-haiku-4-5" />,
  },
];

function ModelId({ id }: { id: string }): React.ReactElement {
  return (
    <code
      style={{
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-faint)',
        background: 'var(--surface-sunken)',
        padding: '2px 6px',
        borderRadius: 999,
      }}
    >
      {id}
    </code>
  );
}

function WarnBadge({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        color: 'var(--color-warning)',
        background: 'var(--color-warning-a09)',
        padding: '2px 7px',
        borderRadius: 999,
      }}
    >
      {children}
    </span>
  );
}

// ── General ────────────────────────────────────────────────────────────────

export const generalPane: PaneDef = {
  id: 'general',
  label: 'General',
  scope: 'app',
  sections: [
    {
      title: 'On launch',
      entries: [
        {
          id: 'startup',
          label: 'On launch',
          keywords: ['startup', 'reopen', 'restore', 'start screen', 'resume'],
          render: (s) =>
            s.app === null ? null : (
              <RadioGroup
                value={s.app.general.startup}
                onChange={(startup) => s.patchApp({ general: { startup } })}
                options={[
                  {
                    value: 'restore-all',
                    label: 'Reopen my last knowledge base and its drafts',
                    hint: 'Drafts whose worktree no longer exists on disk are dropped silently.',
                  },
                  {
                    value: 'restore-kb',
                    label: 'Reopen the knowledge base only',
                    hint: 'Drafts stay closed until you open them.',
                  },
                  {
                    value: 'start-screen',
                    label: 'Always show the start screen',
                    hint: 'Choose a knowledge base each time.',
                  },
                ]}
              />
            ),
        },
      ],
    },
    {
      title: 'Updates',
      entries: [
        {
          id: 'auto-check-updates',
          label: 'Check for updates automatically',
          keywords: ['update', 'upgrade', 'version', 'release'],
          render: (s) =>
            s.app === null ? null : (
              <>
                <Toggle
                  label="Check for updates automatically"
                  hint="Arlo Doc asks GitHub Releases whether a newer build exists."
                  checked={s.app.general.autoCheckUpdates}
                  onChange={(autoCheckUpdates) => s.patchApp({ general: { autoCheckUpdates } })}
                />
                <PendingBadge>Saved — automatic updates are not switched on in this build</PendingBadge>
              </>
            ),
        },
        {
          id: 'auto-install-updates',
          label: 'Download and install in the background',
          keywords: ['update', 'auto install', 'background'],
          render: (s) =>
            s.app === null ? null : (
              <Toggle
                label="Download and install in the background"
                hint="Updates apply the next time you quit."
                checked={s.app.general.autoInstallUpdates}
                disabled={!s.app.general.autoCheckUpdates}
                onChange={(autoInstallUpdates) => s.patchApp({ general: { autoInstallUpdates } })}
              />
            ),
        },
      ],
    },
    {
      title: 'Privacy',
      entries: [
        {
          id: 'privacy',
          label: 'Privacy',
          keywords: ['telemetry', 'analytics', 'tracking', 'crash', 'network', 'data'],
          render: () => (
            <div
              style={{
                fontSize: 12.5,
                lineHeight: 1.65,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                background: 'var(--surface-section)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '14px 16px',
              }}
            >
              <p style={{ margin: 0, marginBottom: 10 }}>
                Arlo Doc collects no analytics and reports no crashes. There is no Arlo server.
              </p>
              <p style={{ margin: 0, marginBottom: 6 }}>It reaches the network in exactly two cases:</p>
              <ul style={{ margin: 0, marginBottom: 10, paddingLeft: 18 }}>
                <li>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>api.anthropic.com</code>{' '}
                  — when you use the agent
                </li>
                <li>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>github.com</code> — for
                  updates, and for pushes you ask for
                </li>
              </ul>
              <p style={{ margin: 0 }}>
                Your documents never leave this machine except through git remotes you configured
                yourself.
              </p>
            </div>
          ),
        },
      ],
    },
  ],
};

// ── Appearance ─────────────────────────────────────────────────────────────

export const appearancePane: PaneDef = {
  id: 'appearance',
  label: 'Appearance',
  scope: 'app',
  sections: [
    {
      title: 'Theme',
      entries: [
        {
          id: 'theme',
          label: 'Theme',
          keywords: ['dark', 'light', 'mode', 'colour', 'color', 'appearance'],
          render: (s) =>
            s.app === null ? null : (
              <RadioGroup
                value={s.app.appearance.theme}
                onChange={(theme) => s.patchApp({ appearance: { theme } })}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System', hint: 'Follow your operating system.' },
                ]}
              />
            ),
        },
      ],
    },
    {
      title: 'Language',
      entries: [
        {
          id: 'interface-language',
          label: 'Interface language',
          keywords: ['locale', 'i18n', 'translate', 'english', 'japanese', 'chinese'],
          render: (s) =>
            s.app === null ? null : (
              <Select
                id="interface-language"
                label="Interface language"
                hint={
                  <>
                    Menus, buttons and messages. Independent of what the agent writes.
                    <br />
                    Your choice is saved, but only English ships today — the other
                    translations are not written yet.
                  </>
                }
                value={s.app.appearance.interfaceLanguage}
                onChange={(interfaceLanguage) => s.patchApp({ appearance: { interfaceLanguage } })}
                options={[
                  { value: 'system', label: 'Follow system' },
                  { value: 'en', label: 'English' },
                  { value: 'zh-Hant', label: '繁體中文' },
                  { value: 'ja', label: '日本語' },
                ]}
              />
            ),
        },
      ],
    },
  ],
};

// ── Editor ─────────────────────────────────────────────────────────────────

export const editorPane: PaneDef = {
  id: 'editor',
  label: 'Editor',
  scope: 'app',
  sections: [
    {
      title: 'Saving',
      entries: [
        {
          id: 'autosave',
          label: 'Save automatically',
          keywords: ['autosave', 'save', 'unsaved', 'draft'],
          render: (s) =>
            s.app === null ? null : (
              <Toggle
                label="Save automatically"
                hint="⌘S saves immediately either way. Every version stays recoverable from git."
                checked={s.app.editor.autosave}
                onChange={(autosave) => s.patchApp({ editor: { autosave } })}
              />
            ),
        },
        {
          id: 'autosave-delay',
          label: 'Autosave delay',
          keywords: ['debounce', 'delay', 'autosave'],
          render: (s) =>
            s.app === null || !s.app.editor.autosave ? null : (
              <NumberField
                id="autosave-delay"
                label="Autosave delay"
                value={s.app.editor.autosaveDelayMs}
                min={200}
                max={10000}
                suffix="ms after you stop typing"
                onCommit={(autosaveDelayMs) => s.patchApp({ editor: { autosaveDelayMs } })}
              />
            ),
        },
      ],
    },
    {
      title: 'Opening a file',
      entries: [
        {
          id: 'open-files-in',
          label: 'Opening a file',
          keywords: ['preview', 'edit', 'default view', 'mode'],
          render: (s) =>
            s.app === null ? null : (
              <RadioGroup
                value={s.app.editor.openFilesIn}
                onChange={(openFilesIn) => s.patchApp({ editor: { openFilesIn } })}
                options={[
                  { value: 'preview', label: 'Preview', hint: 'Reading is the common case.' },
                  { value: 'edit', label: 'Edit' },
                  { value: 'last-used', label: 'Whichever you used last' },
                ]}
              />
            ),
        },
        {
          id: 'front-matter',
          label: 'Front matter',
          keywords: ['yaml', 'frontmatter', 'metadata', 'header'],
          render: (s) =>
            s.app === null ? null : (
              <RadioGroup
                label="Front matter"
                value={s.app.editor.frontMatter}
                onChange={(frontMatter) => s.patchApp({ editor: { frontMatter } })}
                options={[
                  { value: 'hide', label: 'Hide in preview' },
                  { value: 'table', label: 'Show as a table' },
                ]}
              />
            ),
        },
      ],
    },
    {
      title: 'Typography',
      entries: [
        {
          id: 'editor-font',
          label: 'Editor font',
          keywords: ['typeface', 'monospace', 'font family'],
          render: (s) =>
            s.app === null ? null : (
              <TextField
                id="editor-font"
                label="Editor font"
                hint="Leave empty to use the platform monospace stack."
                placeholder="SF Mono"
                value={s.app.editor.fontFamily}
                monospace
                onCommit={(fontFamily) => s.patchApp({ editor: { fontFamily } })}
              />
            ),
        },
        {
          id: 'editor-font-size',
          label: 'Font size',
          keywords: ['text size', 'zoom', 'bigger', 'smaller'],
          render: (s) =>
            s.app === null ? null : (
              <Slider
                id="editor-font-size"
                label="Font size"
                value={s.app.editor.fontSize}
                min={10}
                max={24}
                format={(v) => `${v}px`}
                onChange={(fontSize) => s.patchApp({ editor: { fontSize } })}
              />
            ),
        },
        {
          id: 'editor-line-width',
          label: 'Line width',
          keywords: ['measure', 'column', 'wrap width'],
          render: (s) =>
            s.app === null ? null : (
              <Slider
                id="editor-line-width"
                label="Line width"
                value={s.app.editor.lineWidth}
                min={40}
                max={160}
                format={(v) => `${v}ch`}
                onChange={(lineWidth) => s.patchApp({ editor: { lineWidth } })}
              />
            ),
        },
        {
          id: 'wrap-lines',
          label: 'Wrap long lines',
          keywords: ['word wrap', 'soft wrap'],
          render: (s) =>
            s.app === null ? null : (
              <Toggle
                label="Wrap long lines"
                checked={s.app.editor.wrapLines}
                onChange={(wrapLines) => s.patchApp({ editor: { wrapLines } })}
              />
            ),
        },
        {
          id: 'line-numbers',
          label: 'Show line numbers',
          keywords: ['gutter', 'numbers'],
          render: (s) =>
            s.app === null ? null : (
              <Toggle
                label="Show line numbers"
                // A gutter cannot stay aligned with wrapped lines, so the
                // dependency is stated rather than silently ignored.
                hint={
                  s.app.editor.wrapLines
                    ? 'Unavailable while long lines wrap — a gutter cannot line up with wrapped text.'
                    : undefined
                }
                checked={s.app.editor.lineNumbers}
                disabled={s.app.editor.wrapLines}
                onChange={(lineNumbers) => s.patchApp({ editor: { lineNumbers } })}
              />
            ),
        },
      ],
    },
  ],
};

// ── AI agent ───────────────────────────────────────────────────────────────

export const agentPane: PaneDef = {
  id: 'agent',
  label: 'AI agent',
  scope: 'app',
  sections: [
    {
      title: 'Model',
      entries: [
        {
          id: 'model',
          label: 'Model',
          keywords: ['claude', 'opus', 'sonnet', 'haiku', 'llm'],
          render: (s) =>
            s.app === null ? null : (
              <>
                <RadioGroup
                  value={s.app.agent.model}
                  onChange={(model) => s.patchApp({ agent: { model } })}
                  options={MODEL_OPTIONS}
                />
                <div style={{ marginTop: 10 }}>
                  <PendingBadge>Saved — the agent is not connected in this build</PendingBadge>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--font-sans)',
                    marginTop: 12,
                  }}
                >
                  Billed to your own Anthropic account.{' '}
                  <button
                    type="button"
                    onClick={() => void window.arlodoc.openExternal('https://console.anthropic.com/usage')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      color: 'var(--color-accent)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    Console <ExternalLink size={11} />
                  </button>
                </p>
              </>
            ),
        },
      ],
    },
    {
      title: 'Autonomy',
      entries: [
        {
          id: 'autonomy',
          label: 'Agent autonomy',
          keywords: ['approval', 'permission', 'auto apply', 'review', 'safety'],
          render: (s) =>
            s.app === null ? null : (
              <>
                <RadioGroup
                  value={s.app.agent.autonomy}
                  onChange={(autonomy) => s.patchApp({ agent: { autonomy } })}
                  options={[
                    {
                      value: 'review-each',
                      label: 'Review each change',
                      hint: 'Every edit waits for your approval.',
                    },
                    {
                      value: 'draft-freely',
                      label: 'Apply in the draft, review before publishing',
                      hint: 'Edits land in the worktree; the pull request is the gate.',
                    },
                    {
                      value: 'full',
                      label: 'Full autonomy',
                      hint: 'Edits and commits without asking.',
                      trailing: <WarnBadge>Careful</WarnBadge>,
                    },
                  ]}
                />
                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--font-sans)',
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  Always confirmed, at every level: deleting a file · pushing to a remote.
                </p>
              </>
            ),
        },
      ],
    },
  ],
};

// ── Connections ────────────────────────────────────────────────────────────

export const connectionsPane: PaneDef = {
  id: 'connections',
  label: 'Connections',
  scope: 'app',
  blurb: 'Credentials live in your operating system keychain. Arlo Doc stores only ciphertext.',
  sections: [
    {
      title: 'Anthropic API key',
      entries: [
        {
          id: 'anthropic-key',
          label: 'Anthropic API key',
          keywords: ['api key', 'anthropic', 'credential', 'token', 'secret', 'claude'],
          render: (s) => <AnthropicKeyField s={s} />,
        },
      ],
    },
    {
      title: 'GitHub',
      entries: [
        {
          id: 'github',
          label: 'GitHub account',
          keywords: ['git', 'oauth', 'sign in', 'account', 'token', 'credential'],
          render: (s) => <GithubField s={s} />,
        },
      ],
    },
  ],
};

function AnthropicKeyField({ s }: { s: import('../useSettings').SettingsApi }): React.ReactElement {
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [check, setCheck] = React.useState<{ valid: boolean; message: string | null } | null>(null);
  const status = s.secrets?.anthropic;
  const encryptionOff = s.appInfo?.encryptionAvailable === false;

  async function save(): Promise<void> {
    if (draft.trim() === '') return;
    setBusy(true);
    const res = await window.arlodoc.setAnthropicKey(draft.trim());
    setBusy(false);
    setCheck(null);
    if (res.ok) {
      setDraft('');
      await s.refreshSecrets();
    }
  }

  async function test(): Promise<void> {
    setBusy(true);
    const res = await window.arlodoc.testAnthropicKey();
    setBusy(false);
    if (res.ok) {
      setCheck({ valid: res.data.valid, message: res.data.message });
      await s.refreshSecrets();
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    await window.arlodoc.clearAnthropicKey();
    setBusy(false);
    setCheck(null);
    await s.refreshSecrets();
  }

  if (encryptionOff) {
    return (
      <div
        style={{
          fontSize: 12.5,
          lineHeight: 1.6,
          color: 'var(--color-warning)',
          background: 'var(--color-warning-a09)',
          border: '1px solid var(--color-warning)',
          borderRadius: 12,
          padding: '12px 14px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        This system does not offer encrypted storage, so Arlo Doc will not save your key — it
        would have to be written in plain text. Set <code>ANTHROPIC_API_KEY</code> in your
        environment instead.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {status?.isSet === true ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <code
              style={{
                flex: 1,
                minWidth: 220,
                fontSize: 12.5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-body)',
                background: 'var(--surface-section)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '9px 12px',
              }}
            >
              {status.masked}
            </code>
            <Button onClick={() => void test()} busy={busy}>
              Test
            </Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>
              Remove
            </Button>
          </div>
          {check !== null ? (
            <StatusLine tone={check.valid ? 'success' : 'danger'}>
              {check.valid ? 'Verified just now' : (check.message ?? 'Could not verify')}
            </StatusLine>
          ) : status.lastVerifiedAt !== null ? (
            <StatusLine tone="success">
              Verified · {new Date(status.lastVerifiedAt).toLocaleString()}
            </StatusLine>
          ) : (
            <StatusLine tone="muted">Not verified yet</StatusLine>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="password"
            value={draft}
            placeholder="sk-ant-…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
            }}
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: 'var(--text-body)',
              background: 'var(--surface-card)',
              padding: '9px 12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              outline: 'none',
            }}
          />
          <Button variant="primary" onClick={() => void save()} disabled={draft.trim() === ''} busy={busy}>
            Save
          </Button>
        </div>
      )}
      <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', margin: 0 }}>
        Stored in your operating system keychain. Arlo Doc sends it nowhere except
        api.anthropic.com, and the key is never shown to the app's interface again once saved.
      </p>
    </div>
  );
}

function GithubField({ s }: { s: import('../useSettings').SettingsApi }): React.ReactElement {
  const gh = s.secrets?.github;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {gh?.isSet === true ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StatusLine tone="success">
            {gh.login ?? 'Connected'}
            {gh.scopes.length > 0 && (
              <span style={{ color: 'var(--text-faint)' }}> · {gh.scopes.join(', ')}</span>
            )}
          </StatusLine>
          <Button
            variant="danger"
            onClick={() => {
              void window.arlodoc.clearGithubToken().then(() => s.refreshSecrets());
            }}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <StatusLine tone="muted">
          Not connected. Publishing a draft will ask you to sign in.
        </StatusLine>
      )}
    </div>
  );
}

// ── Keyboard ───────────────────────────────────────────────────────────────

interface Shortcut {
  action: string;
  mac: string;
  other: string;
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: 'Navigation',
    items: [
      { action: 'Search files & content', mac: '⇧⌘F', other: 'Ctrl+Shift+F' },
      { action: 'Next tab', mac: '⌃⇥', other: 'Ctrl+Tab' },
      { action: 'Previous tab', mac: '⌃⇧⇥', other: 'Ctrl+Shift+Tab' },
      { action: 'Toggle chat panel', mac: '⌘J', other: 'Ctrl+J' },
    ],
  },
  {
    group: 'Draft',
    items: [
      { action: 'New draft (worktree)', mac: '⌘T', other: 'Ctrl+T' },
      { action: 'Save file', mac: '⌘S', other: 'Ctrl+S' },
      { action: 'Preview / Edit / What changed', mac: '⌘1 ⌘2 ⌘3', other: 'Ctrl+1 2 3' },
      { action: 'Publish…', mac: '⇧⌘P', other: 'Ctrl+Shift+P' },
    ],
  },
  {
    group: 'Application',
    items: [
      { action: 'Settings', mac: '⌘,', other: 'Ctrl+,' },
      { action: 'Close tab', mac: '⌘W', other: 'Ctrl+W' },
    ],
  },
];

function KeyboardTable(): React.ReactElement {
  const [filter, setFilter] = React.useState('');
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const q = filter.trim().toLowerCase();

  const groups = SHORTCUTS.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) =>
        q === '' ||
        i.action.toLowerCase().includes(q) ||
        (isMac ? i.mac : i.other).toLowerCase().includes(q),
    ),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <input
        type="text"
        value={filter}
        placeholder="Filter shortcuts"
        onChange={(e) => setFilter(e.target.value)}
        style={{
          width: '100%',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          color: 'var(--text-body)',
          background: 'var(--surface-card)',
          padding: '9px 12px',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          outline: 'none',
          marginBottom: 20,
        }}
      />
      {groups.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
          No shortcut matches “{filter}”.
        </p>
      )}
      {groups.map((g) => (
        <div key={g.group} style={{ marginBottom: 24 }}>
          <h4
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-sans)',
              marginBottom: 8,
            }}
          >
            {g.group}
          </h4>
          {g.items.map((i) => (
            <div
              key={i.action}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-body)', fontFamily: 'var(--font-sans)' }}>
                {i.action}
              </span>
              <kbd
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isMac ? i.mac : i.other}
              </kbd>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const keyboardPane: PaneDef = {
  id: 'keyboard',
  label: 'Keyboard',
  scope: 'app',
  blurb: 'A reference, not a remapper — these are fixed for now.',
  custom: () => <KeyboardTable />,
  sections: [],
};

export const APPLICATION_PANES: PaneDef[] = [
  generalPane,
  appearancePane,
  editorPane,
  agentPane,
  connectionsPane,
  keyboardPane,
];

export { ReadOnlyRow };
