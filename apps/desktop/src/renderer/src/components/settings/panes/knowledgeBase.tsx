import React from 'react';
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
function validateBranch(name: string): string | null {
  if (name.trim() === '') return 'A branch name is required.';
  if (/\s/.test(name)) return "Not a valid branch name — spaces aren't allowed.";
  if (/^[-.]|[-.]$/.test(name)) return 'Cannot start or end with a dot or dash.';
  if (/\.\.|@\{|\/\/|[~^:?*[\\]/.test(name)) return 'Contains characters git does not allow.';
  return null;
}

// ── Repository ─────────────────────────────────────────────────────────────

export const repositoryPane: PaneDef = {
  id: 'repository',
  label: 'Repository',
  scope: 'kb',
  sections: [
    {
      title: 'Location',
      entries: [
        {
          id: 'repo-path',
          label: 'Repository path',
          keywords: ['folder', 'location', 'path', 'directory'],
          render: (s) => <RepoPathRow s={s} />,
        },
      ],
    },
    {
      title: 'Branches',
      entries: [
        {
          id: 'default-branch',
          label: 'Default branch',
          keywords: ['main', 'master', 'trunk', 'branch', 'fork'],
          render: (s) =>
            s.kb === null ? null : (
              <TextField
                id="default-branch"
                label="Default branch"
                hint="The branch new drafts fork from."
                value={s.kb.repository.defaultBranch}
                monospace
                validate={validateBranch}
                onCommit={(defaultBranch) => s.patchKb({ repository: { defaultBranch } })}
              />
            ),
        },
      ],
    },
    {
      title: 'Commit identity',
      entries: [
        {
          id: 'git-identity',
          label: 'Commit identity',
          keywords: ['author', 'name', 'email', 'git config', 'user'],
          render: (s) => <IdentityField s={s} />,
        },
        {
          id: 'mark-agent-commits',
          label: 'Mark commits the agent wrote',
          keywords: ['co-authored-by', 'trailer', 'attribution', 'agent', 'provenance'],
          render: (s) =>
            s.kb === null ? null : (
              <>
                <Toggle
                  label="Mark commits the agent wrote"
                  hint="You remain the author — you approved the change."
                  checked={s.kb.repository.markAgentCommits}
                  onChange={(markAgentCommits) => s.patchKb({ repository: { markAgentCommits } })}
                />
                <div style={{ marginLeft: 49 }}>
                  <PendingBadge>Saved — applies once the agent can commit</PendingBadge>
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

function RepoPathRow({ s }: { s: SettingsApi }): React.ReactElement {
  return (
    <ReadOnlyRow
      label="Repository"
      value={s.repoPath ?? 'This knowledge base'}
      hint="Settings on this page apply only to this repository."
      monospace
    />
  );
}

function IdentityField({ s }: { s: SettingsApi }): React.ReactElement | null {
  const [expanded, setExpanded] = React.useState(false);
  if (s.kb === null) return null;
  const override = s.kb.repository.identityOverride;
  const resolved = s.gitIdentity;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {override === null ? (
        resolved !== null ? (
          <ReadOnlyRow
            label="Commit identity"
            value={`${resolved.name} <${resolved.email}>`}
            hint="From your git config — repository-local first, then global."
            monospace
          />
        ) : (
          <Field label="Commit identity">
            <StatusLine tone="warning">
              git has no user.name or user.email configured for this repository.
            </StatusLine>
          </Field>
        )
      ) : (
        <>
          <TextField
            id="identity-name"
            label="Name"
            value={override.name}
            validate={(v) => (v.trim() === '' ? 'A name is required.' : null)}
            onCommit={(name) =>
              s.patchKb({ repository: { identityOverride: { ...override, name } } })
            }
          />
          <TextField
            id="identity-email"
            label="Email"
            value={override.email}
            validate={(v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Not a valid email address.')}
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
            Override for this knowledge base
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
            Use my git config instead
          </Button>
        </div>
      )}
      {expanded && override !== null && (
        <p style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', margin: 0 }}>
          Commits made here will use this identity instead of what git resolves.
        </p>
      )}
    </div>
  );
}

// ── Publishing ─────────────────────────────────────────────────────────────

export const publishingPane: PaneDef = {
  id: 'publishing',
  label: 'Publishing',
  scope: 'kb',
  sections: [
    {
      title: 'Target',
      entries: [
        {
          id: 'merge-into',
          label: 'Merge into',
          keywords: ['target branch', 'base', 'pull request', 'pr', 'remote'],
          render: (s) =>
            s.kb === null ? null : (
              <TextField
                id="merge-into"
                label="Merge into"
                hint={`Leave empty to use the default branch (${s.kb.repository.defaultBranch}).`}
                placeholder={s.kb.repository.defaultBranch}
                value={s.kb.publishing.mergeInto}
                monospace
                validate={(v) => (v.trim() === '' ? null : validateBranch(v))}
                onCommit={(mergeInto) => s.patchKb({ publishing: { mergeInto } })}
              />
            ),
        },
      ],
    },
    {
      title: 'Pull requests',
      entries: [
        {
          id: 'agent-drafts-pr',
          label: 'Let the agent draft the title and description',
          keywords: ['pr', 'pull request', 'summary', 'description', 'ai'],
          render: (s) =>
            s.kb === null ? null : (
              <Toggle
                label="Let the agent draft the title and description"
                hint="Written from the actual diff. You always see and can edit it before the pull request is created."
                checked={s.kb.publishing.agentDraftsPr}
                onChange={(agentDraftsPr) => s.patchKb({ publishing: { agentDraftsPr } })}
              />
            ),
        },
        {
          id: 'open-as-draft',
          label: 'Open as a draft pull request',
          keywords: ['draft pr', 'wip'],
          render: (s) =>
            s.kb === null ? null : (
              <Toggle
                label="Open as a draft pull request"
                checked={s.kb.publishing.openAsDraft}
                onChange={(openAsDraft) => s.patchKb({ publishing: { openAsDraft } })}
              />
            ),
        },
        {
          id: 'pr-template',
          label: 'Description template',
          keywords: ['template', 'body', 'pr', 'format'],
          render: (s) => <PrTemplateField s={s} />,
        },
      ],
    },
    {
      title: 'After merge',
      entries: [
        {
          id: 'delete-after-merge',
          label: "Delete the draft's worktree and branch",
          keywords: ['cleanup', 'worktree', 'branch', 'tidy', 'prune'],
          render: (s) =>
            s.kb === null ? null : (
              <>
                <Toggle
                  label="Delete the draft's worktree and branch once its pull request merges"
                  hint="Orphaned worktrees are the mess this app would otherwise accumulate."
                  checked={s.kb.publishing.deleteWorktreeAfterMerge}
                  onChange={(deleteWorktreeAfterMerge) =>
                    s.patchKb({ publishing: { deleteWorktreeAfterMerge } })
                  }
                />
                <PendingBadge>Saved — nothing detects a merge in this build yet</PendingBadge>
              </>
            ),
        },
      ],
    },
  ],
};

function PrTemplateField({ s }: { s: SettingsApi }): React.ReactElement | null {
  const stored = s.kb?.publishing.prTemplate ?? '';
  const [draft, setDraft] = React.useState(stored);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDraft(stored);
  }, [stored, focused]);

  if (s.kb === null) return null;

  return (
    <Field
      label="Description template"
      hint={
        <>
          <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{summary}}'}</code> and{' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{files}}'}</code> are replaced when the
          pull request is drafted.
        </>
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

export const searchPane: PaneDef = {
  id: 'search',
  label: 'Search & index',
  scope: 'kb',
  sections: [
    {
      title: 'Excluded from search',
      entries: [
        {
          id: 'excludes',
          label: 'Excluded from search',
          keywords: ['ignore', 'exclude', 'node_modules', 'filter', 'skip'],
          render: (s) =>
            s.kb === null ? null : (
              <TagList
                values={s.kb.search.excludes}
                hint="Directory or file names skipped by both search modes."
                onChange={(excludes) => s.patchKb({ search: { excludes } })}
              />
            ),
        },
        {
          id: 'respect-gitignore',
          label: "Also respect this repository's .gitignore",
          keywords: ['gitignore', 'ignore'],
          render: (s) =>
            s.kb === null ? null : (
              <Toggle
                label="Also respect this repository's .gitignore"
                checked={s.kb.search.respectGitignore}
                onChange={(respectGitignore) => s.patchKb({ search: { respectGitignore } })}
              />
            ),
        },
        {
          id: 'include-hidden',
          label: 'Include hidden files',
          keywords: ['dotfiles', 'hidden'],
          render: (s) =>
            s.kb === null ? null : (
              <Toggle
                label="Include hidden files (dotfiles)"
                checked={s.kb.search.includeHidden}
                onChange={(includeHidden) => s.patchKb({ search: { includeHidden } })}
              />
            ),
        },
      ],
    },
    {
      title: 'Search defaults',
      entries: [
        {
          id: 'case-sensitive',
          label: 'Case sensitive',
          keywords: ['case', 'matching'],
          render: (s) =>
            s.kb === null ? null : (
              <Toggle
                label="Case sensitive"
                hint="Where ⇧⌘F starts. You can still change it per search."
                checked={s.kb.search.caseSensitive}
                onChange={(caseSensitive) => s.patchKb({ search: { caseSensitive } })}
              />
            ),
        },
        {
          id: 'use-regex',
          label: 'Regular expressions',
          keywords: ['regex', 'pattern'],
          render: (s) =>
            s.kb === null ? null : (
              <Toggle
                label="Regular expressions"
                checked={s.kb.search.useRegex}
                onChange={(useRegex) => s.patchKb({ search: { useRegex } })}
              />
            ),
        },
        {
          id: 'max-results',
          label: 'Max results',
          keywords: ['limit', 'results', 'cap'],
          render: (s) =>
            s.kb === null ? null : (
              <NumberField
                id="max-results"
                label="Max results"
                value={s.kb.search.maxResults}
                min={10}
                max={5000}
                suffix="per search"
                onCommit={(maxResults) => s.patchKb({ search: { maxResults } })}
              />
            ),
        },
      ],
    },
  ],
};

// ── Instructions ───────────────────────────────────────────────────────────

export const instructionsPane: PaneDef = {
  id: 'instructions',
  label: 'Instructions',
  scope: 'kb',
  blurb: 'Shared with anyone who clones this repository.',
  sections: [
    {
      title: 'Agent instructions',
      entries: [
        {
          id: 'instructions',
          label: 'Agent instructions',
          keywords: ['arlo.md', 'prompt', 'conventions', 'style guide', 'rules'],
          render: (s) => <InstructionsField s={s} />,
        },
      ],
    },
    {
      title: 'Language',
      entries: [
        {
          id: 'writing-language',
          label: 'Writing language',
          keywords: ['language', 'locale', 'translate', 'output'],
          render: (s) =>
            s.kb === null ? null : (
              <Select
                id="writing-language"
                label="Writing language"
                hint="What the agent writes into your files. Independent of the interface language. Saved, but the agent is not connected in this build."
                value={s.kb.agent.writingLanguage}
                onChange={(writingLanguage) => s.patchKb({ agent: { writingLanguage } })}
                options={[
                  { value: 'match-document', label: 'Match the document' },
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

function InstructionsField({ s }: { s: SettingsApi }): React.ReactElement {
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
        Editing
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
        at the repository root
      </div>
      <textarea
        value={draft}
        rows={14}
        placeholder={'# How the agent should write here\n\n- Runbooks use the INC-#### prefix\n- Every ADR needs a Consequences section'}
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
        <StatusLine tone="success">Saved to ARLO.md</StatusLine>
      ) : (
        <StatusLine tone="warning">
          This file is committed — changes appear in your next pull request.
        </StatusLine>
      )}
    </div>
  );
}

export const KB_PANES: PaneDef[] = [
  repositoryPane,
  publishingPane,
  searchPane,
  instructionsPane,
];
