import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import type { AppSettings } from '@arlo-doc/shared';
import { Section } from './fields';
import { useSettings } from './useSettings';
import type { PaneDef } from './paneTypes';
import { searchPanes } from './paneTypes';
import { buildApplicationPanes } from './panes/application';
import { buildKbPanes } from './panes/knowledgeBase';
import { buildAboutPane } from './panes/about';

export interface SettingsModalProps {
  /** Absolute path of the open knowledge base; null disables the KB panes. */
  repoPath: string | null;
  /** Basename shown beside the KNOWLEDGE BASE group heading. */
  repoName: string | null;
  onClose: () => void;
  /** Lets the app shell repaint the moment a setting changes. */
  onAppSettingsChange?: ((next: AppSettings) => void) | undefined;
}

export function SettingsModal({
  repoPath,
  repoName,
  onClose,
  onAppSettingsChange,
}: SettingsModalProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const [activePaneId, setActivePaneId] = React.useState('general');
  const [query, setQuery] = React.useState('');
  const settings = useSettings(repoPath, true, onAppSettingsChange);
  const paneBodyRef = React.useRef<HTMLDivElement>(null);

  // Panes are rebuilt whenever the language changes so every label, section
  // heading and hint re-renders in the new locale. i18n.language is in the dep
  // list because `t` alone is referentially stable across a language switch.
  const ALL_PANES: PaneDef[] = React.useMemo(
    () => [...buildApplicationPanes(t), ...buildKbPanes(t), buildAboutPane(t)],
    [t, i18n.language],
  );

  // Panes needing a repository are disabled without one — "default branch"
  // means nothing when no knowledge base is open.
  const kbDisabled = repoPath === null;
  const activePane = ALL_PANES.find((p) => p.id === activePaneId) ?? ALL_PANES[0]!;
  const hits = searchPanes(
    ALL_PANES.filter((p) => !(kbDisabled && p.scope === 'kb')),
    query,
  );
  const searching = query.trim() !== '';

  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A new pane should start at the top, not wherever the last one was scrolled.
  React.useEffect(() => {
    paneBodyRef.current?.scrollTo({ top: 0 });
  }, [activePaneId, searching]);

  function selectPane(id: string): void {
    setActivePaneId(id);
    setQuery('');
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40 }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'var(--color-scrim)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 880,
          maxWidth: 'calc(100vw - 48px)',
          height: 620,
          maxHeight: 'calc(100vh - 64px)',
          background: 'var(--surface-card)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-overlay)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
        }}
      >
        <Header query={query} onQuery={setQuery} onClose={onClose} />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <Rail
            panes={ALL_PANES}
            activeId={activePaneId}
            repoName={repoName}
            kbDisabled={kbDisabled}
            searching={searching}
            onSelect={selectPane}
          />

          <div
            ref={paneBodyRef}
            style={{ flex: 1, overflowY: 'auto', padding: '26px 32px 40px' }}
          >
            {settings.loading ? (
              <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
                {t('settings.loading')}
              </p>
            ) : searching ? (
              <SearchResults hits={hits} query={query} settings={settings} onJump={selectPane} />
            ) : (
              <PaneBody pane={activePane} settings={settings} kbDisabled={kbDisabled} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({
  query,
  onQuery,
  onClose,
}: {
  query: string;
  onQuery: (q: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 16px 0 24px',
        height: 56,
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-.01em',
          color: 'var(--text-body)',
          fontFamily: 'var(--font-sans)',
          margin: 0,
        }}
      >
        {t('settings.title')}
      </h2>

      <div style={{ position: 'relative', flex: 1, maxWidth: 320, display: 'flex', alignItems: 'center' }}>
        <Search
          size={13}
          style={{ position: 'absolute', left: 11, color: 'var(--text-faint)', pointerEvents: 'none' }}
        />
        <input
          type="text"
          value={query}
          placeholder={t('settings.searchPlaceholder')}
          onChange={(e) => onQuery(e.target.value)}
          style={{
            width: '100%',
            fontFamily: 'var(--font-sans)',
            fontSize: 12.5,
            color: 'var(--text-body)',
            background: 'var(--surface-section)',
            padding: '7px 12px 7px 31px',
            border: '1px solid var(--border)',
            borderRadius: 999,
            outline: 'none',
          }}
        />
      </div>

      <button
        type="button"
        aria-label={t('settings.closeAria')}
        onClick={onClose}
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          border: 'none',
          background: 'none',
          borderRadius: 999,
          color: 'var(--text-faint)',
          cursor: 'pointer',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ── Rail ───────────────────────────────────────────────────────────────────

function Rail({
  panes,
  activeId,
  repoName,
  kbDisabled,
  searching,
  onSelect,
}: {
  panes: PaneDef[];
  activeId: string;
  repoName: string | null;
  kbDisabled: boolean;
  searching: boolean;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const groups: { heading: string; note?: string; panes: PaneDef[] }[] = [
    { heading: t('settings.rail.application'), panes: panes.filter((p) => p.scope === 'app') },
    {
      heading: t('settings.rail.knowledgeBase'),
      ...(kbDisabled
        ? { note: t('settings.rail.noFolderOpen') }
        : repoName !== null
          ? { note: repoName }
          : {}),
      panes: panes.filter((p) => p.scope === 'kb'),
    },
    { heading: '', panes: panes.filter((p) => p.scope === 'about') },
  ];

  return (
    <nav
      style={{
        width: 208,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface-section)',
        overflowY: 'auto',
        padding: '18px 12px',
      }}
    >
      {groups.map((group, gi) => (
        <div key={group.heading || 'about'} style={{ marginBottom: 20 }}>
          {group.heading !== '' ? (
            <div style={{ padding: '0 10px', marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '.07em',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {group.heading}
              </div>
              {group.note !== undefined && (
                <div
                  style={{
                    fontSize: 11,
                    color: kbDisabled ? 'var(--text-dim)' : 'var(--color-accent)',
                    fontFamily: 'var(--font-sans)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {group.note}
                </div>
              )}
            </div>
          ) : (
            gi > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', margin: '0 10px 12px' }} />
            )
          )}

          {group.panes.map((pane) => {
            const disabled = kbDisabled && pane.scope === 'kb';
            const active = !searching && pane.id === activeId;
            return (
              <button
                key={pane.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(pane.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  marginBottom: 1,
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  color: disabled
                    ? 'var(--text-dim)'
                    : active
                      ? 'var(--color-accent)'
                      : 'var(--text-muted-strong)',
                  background: active ? 'var(--color-accent-a08)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {pane.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// ── Pane body ──────────────────────────────────────────────────────────────

function PaneBody({
  pane,
  settings,
  kbDisabled,
}: {
  pane: PaneDef;
  settings: ReturnType<typeof useSettings>;
  kbDisabled: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  if (kbDisabled && pane.scope === 'kb') {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
        {t('settings.openKbToConfigure')}
      </p>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-.015em',
            color: 'var(--text-body)',
            fontFamily: 'var(--font-sans)',
            margin: 0,
          }}
        >
          {pane.label}
        </h3>
        {pane.blurb !== undefined && (
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-sans)',
              margin: '5px 0 0',
            }}
          >
            {pane.blurb}
          </p>
        )}
      </div>

      {pane.custom?.(settings)}

      {pane.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.entries.map((entry) => (
            <React.Fragment key={entry.id}>{entry.render(settings)}</React.Fragment>
          ))}
        </Section>
      ))}
    </>
  );
}

// ── Search results ─────────────────────────────────────────────────────────
// Results are the real controls, not links to them — the entries render
// themselves, so a setting can be changed straight from the result list.

function SearchResults({
  hits,
  query,
  settings,
  onJump,
}: {
  hits: ReturnType<typeof searchPanes>;
  query: string;
  settings: ReturnType<typeof useSettings>;
  onJump: (paneId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  if (hits.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
        {t('settings.noMatch', { query })}
      </p>
    );
  }

  return (
    <>
      <p
        style={{
          fontSize: 12,
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-sans)',
          marginBottom: 20,
        }}
      >
        {t('settings.resultCount', { count: hits.length })}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        {hits.map(({ pane, section, entry }) => (
          <div key={`${pane.id}:${entry.id}`}>
            <button
              type="button"
              onClick={() => onJump(pane.id)}
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.05em',
                textTransform: 'uppercase',
                color: 'var(--color-accent)',
                fontFamily: 'var(--font-sans)',
                background: 'none',
                border: 'none',
                padding: 0,
                marginBottom: 10,
                cursor: 'pointer',
              }}
            >
              {pane.label} · {section.title}
            </button>
            {entry.render(settings)}
          </div>
        ))}
      </div>
    </>
  );
}
