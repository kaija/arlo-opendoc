import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ExternalLink } from 'lucide-react';
import type { PaneDef } from '../paneTypes';
import type { RadioOption } from '../fields';
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

type AgentModel = 'claude-opus-5' | 'claude-sonnet-5' | 'claude-haiku-4-5-20251001';

function modelOptions(t: TFunction): RadioOption<AgentModel>[] {
  return [
    {
      value: 'claude-opus-5',
      label: t('settings.agent.model.mostCapable'),
      hint: t('settings.agent.model.mostCapableHint'),
      trailing: <ModelId id="claude-opus-5" />,
    },
    {
      value: 'claude-sonnet-5',
      label: t('settings.agent.model.balanced'),
      hint: t('settings.agent.model.balancedHint'),
      trailing: <ModelId id="claude-sonnet-5" />,
    },
    {
      value: 'claude-haiku-4-5-20251001',
      label: t('settings.agent.model.fastest'),
      hint: t('settings.agent.model.fastestHint'),
      trailing: <ModelId id="claude-haiku-4-5" />,
    },
  ];
}

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

export function buildGeneralPane(t: TFunction): PaneDef {
  return {
    id: 'general',
    label: t('settings.general.label'),
    scope: 'app',
    sections: [
      {
        title: t('settings.general.sections.onLaunch'),
        entries: [
          {
            id: 'startup',
            label: t('settings.general.startup.label'),
            keywords: ['startup', 'reopen', 'restore', 'start screen', 'resume'],
            render: (s) =>
              s.app === null ? null : (
                <RadioGroup
                  value={s.app.general.startup}
                  onChange={(startup) => s.patchApp({ general: { startup } })}
                  options={[
                    {
                      value: 'restore-all',
                      label: t('settings.general.startup.restoreAll'),
                      hint: t('settings.general.startup.restoreAllHint'),
                    },
                    {
                      value: 'restore-kb',
                      label: t('settings.general.startup.restoreKb'),
                      hint: t('settings.general.startup.restoreKbHint'),
                    },
                    {
                      value: 'start-screen',
                      label: t('settings.general.startup.startScreen'),
                      hint: t('settings.general.startup.startScreenHint'),
                    },
                  ]}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.general.sections.updates'),
        entries: [
          {
            id: 'auto-check-updates',
            label: t('settings.general.autoCheck.label'),
            keywords: ['update', 'upgrade', 'version', 'release'],
            render: (s) =>
              s.app === null ? null : (
                <>
                  <Toggle
                    label={t('settings.general.autoCheck.label')}
                    hint={t('settings.general.autoCheck.hint')}
                    checked={s.app.general.autoCheckUpdates}
                    onChange={(autoCheckUpdates) => s.patchApp({ general: { autoCheckUpdates } })}
                  />
                  <PendingBadge>{t('settings.general.autoCheck.pending')}</PendingBadge>
                </>
              ),
          },
          {
            id: 'auto-install-updates',
            label: t('settings.general.autoInstall.label'),
            keywords: ['update', 'auto install', 'background'],
            render: (s) =>
              s.app === null ? null : (
                <Toggle
                  label={t('settings.general.autoInstall.label')}
                  hint={t('settings.general.autoInstall.hint')}
                  checked={s.app.general.autoInstallUpdates}
                  disabled={!s.app.general.autoCheckUpdates}
                  onChange={(autoInstallUpdates) => s.patchApp({ general: { autoInstallUpdates } })}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.general.sections.privacy'),
        entries: [
          {
            id: 'privacy',
            label: t('settings.general.sections.privacy'),
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
                <p style={{ margin: 0, marginBottom: 10 }}>{t('settings.general.privacy.p1')}</p>
                <p style={{ margin: 0, marginBottom: 6 }}>{t('settings.general.privacy.p2')}</p>
                <ul style={{ margin: 0, marginBottom: 10, paddingLeft: 18 }}>
                  <li>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>api.anthropic.com</code>{' '}
                    {t('settings.general.privacy.li1')}
                  </li>
                  <li>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>github.com</code>{' '}
                    {t('settings.general.privacy.li2')}
                  </li>
                </ul>
                <p style={{ margin: 0 }}>{t('settings.general.privacy.p3')}</p>
              </div>
            ),
          },
        ],
      },
    ],
  };
}

// ── Appearance ─────────────────────────────────────────────────────────────

export function buildAppearancePane(t: TFunction): PaneDef {
  return {
    id: 'appearance',
    label: t('settings.appearance.label'),
    scope: 'app',
    sections: [
      {
        title: t('settings.appearance.sections.theme'),
        entries: [
          {
            id: 'theme',
            label: t('settings.appearance.theme.label'),
            keywords: ['dark', 'light', 'mode', 'colour', 'color', 'appearance'],
            render: (s) =>
              s.app === null ? null : (
                <RadioGroup
                  value={s.app.appearance.theme}
                  onChange={(theme) => s.patchApp({ appearance: { theme } })}
                  options={[
                    { value: 'light', label: t('settings.appearance.theme.light') },
                    { value: 'dark', label: t('settings.appearance.theme.dark') },
                    {
                      value: 'system',
                      label: t('settings.appearance.theme.system'),
                      hint: t('settings.appearance.theme.systemHint'),
                    },
                  ]}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.appearance.sections.language'),
        entries: [
          {
            id: 'interface-language',
            label: t('settings.appearance.language.label'),
            keywords: ['locale', 'i18n', 'translate', 'english', 'japanese', 'chinese', 'language'],
            render: (s) =>
              s.app === null ? null : (
                <Select
                  id="interface-language"
                  label={t('settings.appearance.language.label')}
                  hint={t('settings.appearance.language.hint')}
                  value={s.app.appearance.interfaceLanguage}
                  onChange={(interfaceLanguage) => s.patchApp({ appearance: { interfaceLanguage } })}
                  options={[
                    { value: 'system', label: t('settings.appearance.language.followSystem') },
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
}

// ── Editor ─────────────────────────────────────────────────────────────────

export function buildEditorPane(t: TFunction): PaneDef {
  return {
    id: 'editor',
    label: t('settings.editor.label'),
    scope: 'app',
    sections: [
      {
        title: t('settings.editor.sections.saving'),
        entries: [
          {
            id: 'autosave',
            label: t('settings.editor.autosave.label'),
            keywords: ['autosave', 'save', 'unsaved', 'draft'],
            render: (s) =>
              s.app === null ? null : (
                <Toggle
                  label={t('settings.editor.autosave.label')}
                  hint={t('settings.editor.autosave.hint')}
                  checked={s.app.editor.autosave}
                  onChange={(autosave) => s.patchApp({ editor: { autosave } })}
                />
              ),
          },
          {
            id: 'autosave-delay',
            label: t('settings.editor.autosaveDelay.label'),
            keywords: ['debounce', 'delay', 'autosave'],
            render: (s) =>
              s.app === null || !s.app.editor.autosave ? null : (
                <NumberField
                  id="autosave-delay"
                  label={t('settings.editor.autosaveDelay.label')}
                  value={s.app.editor.autosaveDelayMs}
                  min={200}
                  max={10000}
                  suffix={t('settings.editor.autosaveDelay.suffix')}
                  onCommit={(autosaveDelayMs) => s.patchApp({ editor: { autosaveDelayMs } })}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.editor.sections.openingFile'),
        entries: [
          {
            id: 'open-files-in',
            label: t('settings.editor.sections.openingFile'),
            keywords: ['preview', 'edit', 'default view', 'mode'],
            render: (s) =>
              s.app === null ? null : (
                <RadioGroup
                  value={s.app.editor.openFilesIn}
                  onChange={(openFilesIn) => s.patchApp({ editor: { openFilesIn } })}
                  options={[
                    {
                      value: 'preview',
                      label: t('settings.editor.openFilesIn.preview'),
                      hint: t('settings.editor.openFilesIn.previewHint'),
                    },
                    { value: 'edit', label: t('settings.editor.openFilesIn.edit') },
                    { value: 'last-used', label: t('settings.editor.openFilesIn.lastUsed') },
                  ]}
                />
              ),
          },
          {
            id: 'front-matter',
            label: t('settings.editor.frontMatter.label'),
            keywords: ['yaml', 'frontmatter', 'metadata', 'header'],
            render: (s) =>
              s.app === null ? null : (
                <RadioGroup
                  label={t('settings.editor.frontMatter.label')}
                  value={s.app.editor.frontMatter}
                  onChange={(frontMatter) => s.patchApp({ editor: { frontMatter } })}
                  options={[
                    { value: 'hide', label: t('settings.editor.frontMatter.hide') },
                    { value: 'table', label: t('settings.editor.frontMatter.table') },
                  ]}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.editor.sections.typography'),
        entries: [
          {
            id: 'editor-font',
            label: t('settings.editor.font.label'),
            keywords: ['typeface', 'monospace', 'font family'],
            render: (s) =>
              s.app === null ? null : (
                <TextField
                  id="editor-font"
                  label={t('settings.editor.font.label')}
                  hint={t('settings.editor.font.hint')}
                  placeholder={t('settings.editor.font.placeholder')}
                  value={s.app.editor.fontFamily}
                  monospace
                  onCommit={(fontFamily) => s.patchApp({ editor: { fontFamily } })}
                />
              ),
          },
          {
            id: 'editor-font-size',
            label: t('settings.editor.fontSize.label'),
            keywords: ['text size', 'zoom', 'bigger', 'smaller'],
            render: (s) =>
              s.app === null ? null : (
                <Slider
                  id="editor-font-size"
                  label={t('settings.editor.fontSize.label')}
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
            label: t('settings.editor.lineWidth.label'),
            keywords: ['measure', 'column', 'wrap width'],
            render: (s) =>
              s.app === null ? null : (
                <Slider
                  id="editor-line-width"
                  label={t('settings.editor.lineWidth.label')}
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
            label: t('settings.editor.wrapLines.label'),
            keywords: ['word wrap', 'soft wrap'],
            render: (s) =>
              s.app === null ? null : (
                <Toggle
                  label={t('settings.editor.wrapLines.label')}
                  checked={s.app.editor.wrapLines}
                  onChange={(wrapLines) => s.patchApp({ editor: { wrapLines } })}
                />
              ),
          },
          {
            id: 'line-numbers',
            label: t('settings.editor.lineNumbers.label'),
            keywords: ['gutter', 'numbers'],
            render: (s) =>
              s.app === null ? null : (
                <Toggle
                  label={t('settings.editor.lineNumbers.label')}
                  // A gutter cannot stay aligned with wrapped lines, so the
                  // dependency is stated rather than silently ignored.
                  hint={
                    s.app.editor.wrapLines
                      ? t('settings.editor.lineNumbers.hintWrapping')
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
}

// ── AI agent ───────────────────────────────────────────────────────────────

export function buildAgentPane(t: TFunction): PaneDef {
  return {
    id: 'agent',
    label: t('settings.agent.label'),
    scope: 'app',
    sections: [
      {
        title: t('settings.agent.sections.model'),
        entries: [
          {
            id: 'model',
            label: t('settings.agent.sections.model'),
            keywords: ['claude', 'opus', 'sonnet', 'haiku', 'llm'],
            render: (s) =>
              s.app === null ? null : (
                <>
                  <RadioGroup
                    value={s.app.agent.model}
                    onChange={(model) => s.patchApp({ agent: { model } })}
                    options={modelOptions(t)}
                  />
                  <div style={{ marginTop: 10 }}>
                    <PendingBadge>{t('settings.agent.model.pending')}</PendingBadge>
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-faint)',
                      fontFamily: 'var(--font-sans)',
                      marginTop: 12,
                    }}
                  >
                    {t('settings.agent.model.billed')}{' '}
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
                      {t('settings.agent.model.console')} <ExternalLink size={11} />
                    </button>
                  </p>
                </>
              ),
          },
        ],
      },
      {
        title: t('settings.agent.sections.autonomy'),
        entries: [
          {
            id: 'autonomy',
            label: t('settings.agent.autonomy.label'),
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
                        label: t('settings.agent.autonomy.reviewEach'),
                        hint: t('settings.agent.autonomy.reviewEachHint'),
                      },
                      {
                        value: 'draft-freely',
                        label: t('settings.agent.autonomy.draftFreely'),
                        hint: t('settings.agent.autonomy.draftFreelyHint'),
                      },
                      {
                        value: 'full',
                        label: t('settings.agent.autonomy.full'),
                        hint: t('settings.agent.autonomy.fullHint'),
                        trailing: <WarnBadge>{t('settings.agent.autonomy.fullBadge')}</WarnBadge>,
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
                    {t('settings.agent.autonomy.alwaysConfirmed')}
                  </p>
                </>
              ),
          },
        ],
      },
    ],
  };
}

// ── Connections ────────────────────────────────────────────────────────────

export function buildConnectionsPane(t: TFunction): PaneDef {
  return {
    id: 'connections',
    label: t('settings.connections.label'),
    scope: 'app',
    blurb: t('settings.connections.blurb'),
    sections: [
      {
        title: t('settings.connections.sections.anthropic'),
        entries: [
          {
            id: 'anthropic-key',
            label: t('settings.connections.sections.anthropic'),
            keywords: ['api key', 'anthropic', 'credential', 'token', 'secret', 'claude'],
            render: (s) => <AnthropicKeyField s={s} />,
          },
        ],
      },
      {
        title: t('settings.connections.sections.github'),
        entries: [
          {
            id: 'github',
            label: t('settings.connections.sections.github'),
            keywords: ['git', 'oauth', 'sign in', 'account', 'token', 'credential'],
            render: (s) => <GithubField s={s} />,
          },
        ],
      },
    ],
  };
}

function AnthropicKeyField({ s }: { s: import('../useSettings').SettingsApi }): React.ReactElement {
  const { t } = useTranslation();
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
        <Trans i18nKey="settings.connections.anthropic.encryptionOff" components={{ code: <code /> }} />
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
              {t('settings.connections.anthropic.test')}
            </Button>
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>
              {t('settings.connections.anthropic.remove')}
            </Button>
          </div>
          {check !== null ? (
            <StatusLine tone={check.valid ? 'success' : 'danger'}>
              {check.valid
                ? t('settings.connections.anthropic.verifiedJustNow')
                : (check.message ?? t('settings.connections.anthropic.couldNotVerify'))}
            </StatusLine>
          ) : status.lastVerifiedAt !== null ? (
            <StatusLine tone="success">
              {t('settings.connections.anthropic.verifiedAt', {
                date: new Date(status.lastVerifiedAt).toLocaleString(),
              })}
            </StatusLine>
          ) : (
            <StatusLine tone="muted">{t('settings.connections.anthropic.notVerifiedYet')}</StatusLine>
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
            {t('settings.connections.anthropic.save')}
          </Button>
        </div>
      )}
      <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', margin: 0 }}>
        {t('settings.connections.anthropic.storedNote')}
      </p>
    </div>
  );
}

function GithubField({ s }: { s: import('../useSettings').SettingsApi }): React.ReactElement {
  const { t } = useTranslation();
  const gh = s.secrets?.github;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {gh?.isSet === true ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <StatusLine tone="success">
            {gh.login ?? t('settings.connections.github.connected')}
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
            {t('settings.connections.github.disconnect')}
          </Button>
        </div>
      ) : (
        <StatusLine tone="muted">{t('settings.connections.github.notConnected')}</StatusLine>
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

function shortcutGroups(t: TFunction): { group: string; items: Shortcut[] }[] {
  return [
    {
      group: t('settings.keyboard.groups.navigation'),
      items: [
        { action: t('settings.keyboard.actions.searchFilesAndContent'), mac: '⇧⌘F', other: 'Ctrl+Shift+F' },
        { action: t('settings.keyboard.actions.nextTab'), mac: '⌃⇥', other: 'Ctrl+Tab' },
        { action: t('settings.keyboard.actions.previousTab'), mac: '⌃⇧⇥', other: 'Ctrl+Shift+Tab' },
        { action: t('settings.keyboard.actions.toggleChatPanel'), mac: '⌘J', other: 'Ctrl+J' },
      ],
    },
    {
      group: t('settings.keyboard.groups.draft'),
      items: [
        { action: t('settings.keyboard.actions.newDraft'), mac: '⌘T', other: 'Ctrl+T' },
        { action: t('settings.keyboard.actions.saveFile'), mac: '⌘S', other: 'Ctrl+S' },
        { action: t('settings.keyboard.actions.previewEditWhatChanged'), mac: '⌘1 ⌘2 ⌘3', other: 'Ctrl+1 2 3' },
        { action: t('settings.keyboard.actions.publish'), mac: '⇧⌘P', other: 'Ctrl+Shift+P' },
      ],
    },
    {
      group: t('settings.keyboard.groups.application'),
      items: [
        { action: t('settings.keyboard.actions.settings'), mac: '⌘,', other: 'Ctrl+,' },
        { action: t('settings.keyboard.actions.closeTab'), mac: '⌘W', other: 'Ctrl+W' },
      ],
    },
  ];
}

function KeyboardTable(): React.ReactElement {
  const { t } = useTranslation();
  const [filter, setFilter] = React.useState('');
  const isMac = navigator.platform.toLowerCase().includes('mac');
  const q = filter.trim().toLowerCase();

  const groups = shortcutGroups(t)
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          q === '' ||
          i.action.toLowerCase().includes(q) ||
          (isMac ? i.mac : i.other).toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <input
        type="text"
        value={filter}
        placeholder={t('settings.keyboard.filterPlaceholder')}
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
          {t('settings.keyboard.noMatch', { filter })}
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

export function buildKeyboardPane(t: TFunction): PaneDef {
  return {
    id: 'keyboard',
    label: t('settings.keyboard.label'),
    scope: 'app',
    blurb: t('settings.keyboard.blurb'),
    custom: () => <KeyboardTable />,
    sections: [],
  };
}

export function buildApplicationPanes(t: TFunction): PaneDef[] {
  return [
    buildGeneralPane(t),
    buildAppearancePane(t),
    buildEditorPane(t),
    buildAgentPane(t),
    buildConnectionsPane(t),
    buildKeyboardPane(t),
  ];
}

export { ReadOnlyRow };
