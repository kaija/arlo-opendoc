import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { PaneDef } from '../paneTypes';
import type { SettingsApi } from '../useSettings';
import {
  Button,
  PendingBadge,
  Field,
  NumberField,
  ReadOnlyRow,
  Select,
  StatusLine,
  TagList,
  TextField,
  Toggle,
} from '../fields';

/**
 * Git refuses these outright, so rejecting them here explains the problem while
 * the user still has the cursor in the field rather than at push time.
 */
function validateBranch(name: string, t: TFunction): string | null {
  if (name.trim() === '') return t('settings.repository.branch.required');
  if (/\s/.test(name)) return t('settings.repository.branch.noSpaces');
  if (/^[-.]|[-.]$/.test(name)) return t('settings.repository.branch.noDotDash');
  if (/\.\.|@\{|\/\/|[~^:?*[\\]/.test(name)) return t('settings.repository.branch.illegalChars');
  return null;
}

// ── Repository ─────────────────────────────────────────────────────────────

export function buildRepositoryPane(t: TFunction): PaneDef {
  return {
    id: 'repository',
    label: t('settings.repository.label'),
    scope: 'kb',
    sections: [
      {
        title: t('settings.repository.sections.location'),
        entries: [
          {
            id: 'repo-path',
            label: t('settings.repository.repoPath.entryLabel'),
            keywords: ['folder', 'location', 'path', 'directory'],
            render: (s) => <RepoPathRow s={s} />,
          },
        ],
      },
      {
        title: t('settings.repository.sections.branches'),
        entries: [
          {
            id: 'default-branch',
            label: t('settings.repository.defaultBranch.label'),
            keywords: ['main', 'master', 'trunk', 'branch', 'fork'],
            render: (s) =>
              s.kb === null ? null : (
                <TextField
                  id="default-branch"
                  label={t('settings.repository.defaultBranch.label')}
                  hint={t('settings.repository.defaultBranch.hint')}
                  value={s.kb.repository.defaultBranch}
                  monospace
                  validate={(name) => validateBranch(name, t)}
                  onCommit={(defaultBranch) => s.patchKb({ repository: { defaultBranch } })}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.repository.sections.commitIdentity'),
        entries: [
          {
            id: 'git-identity',
            label: t('settings.repository.identity.entryLabel'),
            keywords: ['author', 'name', 'email', 'git config', 'user'],
            render: (s) => <IdentityField s={s} />,
          },
          {
            id: 'mark-agent-commits',
            label: t('settings.repository.markAgentCommits.label'),
            keywords: ['co-authored-by', 'trailer', 'attribution', 'agent', 'provenance'],
            render: (s) =>
              s.kb === null ? null : (
                <>
                  <Toggle
                    label={t('settings.repository.markAgentCommits.label')}
                    hint={t('settings.repository.markAgentCommits.hint')}
                    checked={s.kb.repository.markAgentCommits}
                    onChange={(markAgentCommits) => s.patchKb({ repository: { markAgentCommits } })}
                  />
                  <div style={{ marginLeft: 49 }}>
                    <PendingBadge>{t('settings.repository.markAgentCommits.pending')}</PendingBadge>
                  </div>
                  {s.kb.repository.markAgentCommits && (
                    <pre
                      style={{
                        fontSize: 11.5,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-muted)',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        margin: '10px 0 0 49px',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {'docs: add idempotency failure mode\n\nCo-Authored-By: Arlo Agent <agent@arlo-ai.app>'}
                    </pre>
                  )}
                </>
              ),
          },
        ],
      },
    ],
  };
}

function RepoPathRow({ s }: { s: SettingsApi }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <ReadOnlyRow
      label={t('settings.repository.repoPath.fieldLabel')}
      value={s.repoPath ?? t('settings.repository.repoPath.fallbackValue')}
      hint={t('settings.repository.repoPath.hint')}
      monospace
    />
  );
}

function IdentityField({ s }: { s: SettingsApi }): React.ReactElement | null {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  if (s.kb === null) return null;
  const override = s.kb.repository.identityOverride;
  const resolved = s.gitIdentity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {override === null ? (
        resolved !== null ? (
          <ReadOnlyRow
            label={t('settings.repository.identity.entryLabel')}
            value={`${resolved.name} <${resolved.email}>`}
            hint={t('settings.repository.identity.fromGitConfig')}
            monospace
          />
        ) : (
          <Field label={t('settings.repository.identity.entryLabel')}>
            <StatusLine tone="warning">{t('settings.repository.identity.noGitConfig')}</StatusLine>
          </Field>
        )
      ) : (
        <>
          <TextField
            id="identity-name"
            label={t('settings.repository.identity.name')}
            value={override.name}
            validate={(v) => (v.trim() === '' ? t('settings.repository.identity.nameRequired') : null)}
            onCommit={(name) =>
              s.patchKb({ repository: { identityOverride: { ...override, name } } })
            }
          />
          <TextField
            id="identity-email"
            label={t('settings.repository.identity.email')}
            value={override.email}
            validate={(v) =>
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : t('settings.repository.identity.emailInvalid')
            }
            onCommit={(email) =>
              s.patchKb({ repository: { identityOverride: { ...override, email } } })
            }
          />
        </>
      )}

      {override === null ? (
        <div>
          <Button
            onClick={() => {
              setExpanded(true);
              s.patchKb({
                repository: {
                  identityOverride: {
                    name: resolved?.name ?? '',
                    email: resolved?.email ?? '',
                  },
                },
              });
            }}
          >
            {t('settings.repository.identity.override')}
          </Button>
        </div>
      ) : (
        <div>
          <Button
            onClick={() => {
              setExpanded(false);
              s.patchKb({ repository: { identityOverride: null } });
            }}
          >
            {t('settings.repository.identity.useGitConfig')}
          </Button>
        </div>
      )}
      {expanded && override !== null && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          {t('settings.repository.identity.overrideNote')}
        </p>
      )}
    </div>
  );
}

// ── Publishing ─────────────────────────────────────────────────────────────

export function buildPublishingPane(t: TFunction): PaneDef {
  return {
    id: 'publishing',
    label: t('settings.publishing.label'),
    scope: 'kb',
    sections: [
      {
        title: t('settings.publishing.sections.target'),
        entries: [
          {
            id: 'merge-into',
            label: t('settings.publishing.mergeInto.label'),
            keywords: ['target branch', 'base', 'pull request', 'pr', 'remote'],
            render: (s) =>
              s.kb === null ? null : (
                <TextField
                  id="merge-into"
                  label={t('settings.publishing.mergeInto.label')}
                  hint={t('settings.publishing.mergeInto.hint', {
                    branch: s.kb.repository.defaultBranch,
                  })}
                  placeholder={s.kb.repository.defaultBranch}
                  value={s.kb.publishing.mergeInto}
                  monospace
                  validate={(v) => (v.trim() === '' ? null : validateBranch(v, t))}
                  onCommit={(mergeInto) => s.patchKb({ publishing: { mergeInto } })}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.publishing.sections.pullRequests'),
        entries: [
          {
            id: 'agent-drafts-pr',
            label: t('settings.publishing.agentDraftsPr.label'),
            keywords: ['pr', 'pull request', 'summary', 'description', 'ai'],
            render: (s) =>
              s.kb === null ? null : (
                <Toggle
                  label={t('settings.publishing.agentDraftsPr.label')}
                  hint={t('settings.publishing.agentDraftsPr.hint')}
                  checked={s.kb.publishing.agentDraftsPr}
                  onChange={(agentDraftsPr) => s.patchKb({ publishing: { agentDraftsPr } })}
                />
              ),
          },
          {
            id: 'open-as-draft',
            label: t('settings.publishing.openAsDraft.label'),
            keywords: ['draft pr', 'wip'],
            render: (s) =>
              s.kb === null ? null : (
                <Toggle
                  label={t('settings.publishing.openAsDraft.label')}
                  checked={s.kb.publishing.openAsDraft}
                  onChange={(openAsDraft) => s.patchKb({ publishing: { openAsDraft } })}
                />
              ),
          },
          {
            id: 'pr-template',
            label: t('settings.publishing.prTemplate.label'),
            keywords: ['template', 'body', 'pr', 'format'],
            render: (s) => <PrTemplateField s={s} />,
          },
        ],
      },
      {
        title: t('settings.publishing.sections.afterMerge'),
        entries: [
          {
            id: 'delete-after-merge',
            label: t('settings.publishing.deleteAfterMerge.label'),
            keywords: ['cleanup', 'worktree', 'branch', 'tidy', 'prune'],
            render: (s) =>
              s.kb === null ? null : (
                <>
                  <Toggle
                    label={t('settings.publishing.deleteAfterMerge.label')}
                    hint={t('settings.publishing.deleteAfterMerge.hint')}
                    checked={s.kb.publishing.deleteWorktreeAfterMerge}
                    onChange={(deleteWorktreeAfterMerge) =>
                      s.patchKb({ publishing: { deleteWorktreeAfterMerge } })
                    }
                  />
                  <PendingBadge>{t('settings.publishing.deleteAfterMerge.pending')}</PendingBadge>
                </>
              ),
          },
        ],
      },
    ],
  };
}

function PrTemplateField({ s }: { s: SettingsApi }): React.ReactElement | null {
  const { t } = useTranslation();
  const stored = s.kb?.publishing.prTemplate ?? '';
  const [draft, setDraft] = React.useState(stored);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDraft(stored);
  }, [stored, focused]);

  if (s.kb === null) return null;

  return (
    <Field
      label={t('settings.publishing.prTemplate.label')}
      hint={
        <Trans
          i18nKey="settings.publishing.prTemplate.hint"
          values={{ summary: '{{summary}}', files: '{{files}}' }}
          components={{ code: <code style={{ fontFamily: 'var(--font-mono)' }} /> }}
        />
      }
    >
      <textarea
        value={draft}
        rows={8}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft !== stored) s.patchKb({ publishing: { prTemplate: draft } });
        }}
        style={{
          width: '100%',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          color: 'var(--text-body)',
          background: 'var(--surface-card)',
          padding: '10px 12px',
          border: `1px solid ${focused ? 'var(--color-accent)' : 'var(--border-strong)'}`,
          borderRadius: 8,
          outline: 'none',
          resize: 'vertical',
        }}
      />
    </Field>
  );
}

// ── Search & index ─────────────────────────────────────────────────────────

export function buildSearchPane(t: TFunction): PaneDef {
  return {
    id: 'search',
    label: t('settings.searchIndex.label'),
    scope: 'kb',
    sections: [
      {
        title: t('settings.searchIndex.sections.excluded'),
        entries: [
          {
            id: 'excludes',
            label: t('settings.searchIndex.sections.excluded'),
            keywords: ['ignore', 'exclude', 'node_modules', 'filter', 'skip'],
            render: (s) =>
              s.kb === null ? null : (
                <TagList
                  values={s.kb.search.excludes}
                  hint={t('settings.searchIndex.excludes.hint')}
                  onChange={(excludes) => s.patchKb({ search: { excludes } })}
                />
              ),
          },
          {
            id: 'respect-gitignore',
            label: t('settings.searchIndex.respectGitignore.label'),
            keywords: ['gitignore', 'ignore'],
            render: (s) =>
              s.kb === null ? null : (
                <Toggle
                  label={t('settings.searchIndex.respectGitignore.label')}
                  checked={s.kb.search.respectGitignore}
                  onChange={(respectGitignore) => s.patchKb({ search: { respectGitignore } })}
                />
              ),
          },
          {
            id: 'include-hidden',
            label: t('settings.searchIndex.includeHidden.label'),
            keywords: ['dotfiles', 'hidden'],
            render: (s) =>
              s.kb === null ? null : (
                <Toggle
                  label={t('settings.searchIndex.includeHidden.label')}
                  checked={s.kb.search.includeHidden}
                  onChange={(includeHidden) => s.patchKb({ search: { includeHidden } })}
                />
              ),
          },
        ],
      },
      {
        title: t('settings.searchIndex.sections.defaults'),
        entries: [
          {
            id: 'case-sensitive',
            label: t('settings.searchIndex.caseSensitive.label'),
            keywords: ['case', 'matching'],
            render: (s) =>
              s.kb === null ? null : (
                <Toggle
                  label={t('settings.searchIndex.caseSensitive.label')}
                  hint={t('settings.searchIndex.caseSensitive.hint')}
                  checked={s.kb.search.caseSensitive}
                  onChange={(caseSensitive) => s.patchKb({ search: { caseSensitive } })}
                />
              ),
          },
          {
            id: 'use-regex',
            label: t('settings.searchIndex.useRegex.label'),
            keywords: ['regex', 'pattern'],
            render: (s) =>
              s.kb === null ? null : (
                <Toggle
                  label={t('settings.searchIndex.useRegex.label')}
                  checked={s.kb.search.useRegex}
                  onChange={(useRegex) => s.patchKb({ search: { useRegex } })}
                />
              ),
          },
          {
            id: 'max-results',
            label: t('settings.searchIndex.maxResults.label'),
            keywords: ['limit', 'results', 'cap'],
            render: (s) =>
              s.kb === null ? null : (
                <NumberField
                  id="max-results"
                  label={t('settings.searchIndex.maxResults.label')}
                  value={s.kb.search.maxResults}
                  min={10}
                  max={5000}
                  suffix={t('settings.searchIndex.maxResults.suffix')}
                  onCommit={(maxResults) => s.patchKb({ search: { maxResults } })}
                />
              ),
          },
        ],
      },
    ],
  };
}

// ── Instructions ───────────────────────────────────────────────────────────

export function buildInstructionsPane(t: TFunction): PaneDef {
  return {
    id: 'instructions',
    label: t('settings.instructions.label'),
    scope: 'kb',
    blurb: t('settings.instructions.blurb'),
    sections: [
      {
        title: t('settings.instructions.sections.agentInstructions'),
        entries: [
          {
            id: 'instructions',
            label: t('settings.instructions.sections.agentInstructions'),
            keywords: ['arlo.md', 'prompt', 'conventions', 'style guide', 'rules'],
            render: (s) => <InstructionsField s={s} />,
          },
        ],
      },
      {
        title: t('settings.instructions.sections.language'),
        entries: [
          {
            id: 'writing-language',
            label: t('settings.instructions.writingLanguage.label'),
            keywords: ['language', 'locale', 'translate', 'output'],
            render: (s) =>
              s.kb === null ? null : (
                <Select
                  id="writing-language"
                  label={t('settings.instructions.writingLanguage.label')}
                  hint={t('settings.instructions.writingLanguage.hint')}
                  value={s.kb.agent.writingLanguage}
                  onChange={(writingLanguage) => s.patchKb({ agent: { writingLanguage } })}
                  options={[
                    { value: 'match-document', label: t('settings.instructions.writingLanguage.matchDocument') },
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

function InstructionsField({ s }: { s: SettingsApi }): React.ReactElement {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState(s.instructions);
  const [focused, setFocused] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDraft(s.instructions);
  }, [s.instructions, focused]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {t('settings.instructions.editor.editingPrefix')}
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: 'var(--text-muted-strong)',
            background: 'var(--surface-sunken)',
            padding: '2px 7px',
            borderRadius: 999,
          }}
        >
          ARLO.md
        </code>
        {t('settings.instructions.editor.editingSuffix')}
      </div>
      <textarea
        value={draft}
        rows={14}
        placeholder={t('settings.instructions.editor.placeholder')}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (draft !== s.instructions) {
            void s.saveInstructions(draft).then(() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            });
          }
        }}
        style={{
          width: '100%',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.65,
          color: 'var(--text-body)',
          background: 'var(--surface-card)',
          padding: '12px 14px',
          border: `1px solid ${focused ? 'var(--color-accent)' : 'var(--border-strong)'}`,
          borderRadius: 8,
          outline: 'none',
          resize: 'vertical',
        }}
      />
      {saved ? (
        <StatusLine tone="success">{t('settings.instructions.editor.savedToArlo')}</StatusLine>
      ) : (
        <StatusLine tone="warning">{t('settings.instructions.editor.committedNote')}</StatusLine>
      )}
    </div>
  );
}

export function buildKbPanes(t: TFunction): PaneDef[] {
  return [
    buildRepositoryPane(t),
    buildPublishingPane(t),
    buildSearchPane(t),
    buildInstructionsPane(t),
  ];
}
