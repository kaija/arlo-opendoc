import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Settings } from 'lucide-react';

interface SidebarNote {
  id: string;
  title: string;
  isNew?: boolean;
  isModified?: boolean;
}

interface NotebookItem {
  id: string;
  label: string;
  notes: SidebarNote[];
  hasModified?: boolean;
}

const NOTEBOOKS: NotebookItem[] = [
  { id: 'getting-started', label: 'Getting Started', notes: [] },
  { id: 'services', label: 'Services', notes: [] },
  {
    id: 'runbooks',
    label: 'Runbooks',
    hasModified: true,
    notes: [
      { id: 'payments', title: 'Payments service runbook', isModified: true },
      { id: 'deploy-rollback', title: 'Deploy rollback' },
      { id: 'on-call', title: 'On-call handover', isModified: true },
      { id: 'inc2291', title: 'INC-2291 follow-ups', isNew: true },
      { id: 'db-failover', title: 'Database failover drill' },
      { id: 'kafka', title: 'Kafka consumer lag' },
      { id: 'cert-rotation', title: 'Certificate rotation' },
    ],
  },
  {
    id: 'adr',
    label: 'Architecture Decisions',
    notes: [],
    hasModified: true,
  },
  { id: 'incidents', label: 'Incidents', notes: [] },
  { id: 'api', label: 'API Reference', notes: [] },
  { id: 'team', label: 'Team', notes: [] },
];

interface SidebarProps {
  variant: 'live' | 'draft';
  activeNoteId?: string;
  expandedNotebooks?: string[];
  onNoteClick?: (noteId: string) => void;
  onNotebookToggle?: (notebookId: string) => void;
}

export function Sidebar({ variant, activeNoteId, expandedNotebooks = [], onNoteClick = () => {}, onNotebookToggle = () => {} }: SidebarProps): React.ReactElement {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        background: 'var(--surface-section)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Knowledge base selector */}
      <div style={{ padding: '10px 10px 4px' }}>
        <div
          style={{
            height: 34,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0 8px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {/* Avatar */}
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--text-on-accent)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              P
            </span>
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-body)',
              fontFamily: 'var(--font-sans)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Platform Handbook
          </span>
          <ChevronDown size={12} color="var(--text-faint)" style={{ flexShrink: 0 }} />
        </div>
      </div>

      {/* NOTEBOOKS label */}
      <div
        style={{
          padding: '12px 18px 6px',
          fontSize: 11,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-faint)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {t('sidebar.notebooks')}
      </div>

      {/* Notebook list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 8px',
        }}
      >
        {NOTEBOOKS.map((nb) => {
          const isExpanded = expandedNotebooks.includes(nb.id);
          return (
          <React.Fragment key={nb.id}>
            {/* Notebook row */}
            <div
              onClick={() => onNotebookToggle(nb.id)}
              style={{
                height: 26,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 8px',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {isExpanded ? (
                <ChevronDown size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              ) : (
                <ChevronRight size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              )}
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  fontWeight: isExpanded ? 600 : 500,
                  color: isExpanded ? 'var(--text-body)' : 'var(--text-muted-strong)',
                  fontFamily: 'var(--font-sans)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nb.label}
              </span>
              {nb.hasModified && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--color-warning)',
                    fontFamily: 'var(--font-sans)',
                    flexShrink: 0,
                  }}
                >
                  (M)
                </span>
              )}
            </div>

            {/* Note rows (expanded notebooks only) */}
            {isExpanded &&
              nb.notes.map((note) => {
                const isActive = note.id === activeNoteId;
                const isHovered = hoveredId === note.id && !isActive;
                return (
                  <div
                    key={note.id}
                    onClick={() => onNoteClick(note.id)}
                    onMouseEnter={() => setHoveredId(note.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 30,
                      paddingRight: 8,
                      borderRadius: 6,
                      background: isActive
                        ? 'var(--color-accent-a08)'
                        : isHovered
                        ? 'var(--color-accent-a04)'
                        : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12.5,
                        fontWeight: isActive ? 500 : 400,
                        color: isActive ? 'var(--color-accent)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {note.title}
                    </span>
                    {note.isModified && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--color-warning)',
                          fontFamily: 'var(--font-sans)',
                          marginLeft: 4,
                          flexShrink: 0,
                        }}
                      >
                        (M)
                      </span>
                    )}
                    {note.isNew && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--color-success)',
                          fontFamily: 'var(--font-sans)',
                          marginLeft: 4,
                          flexShrink: 0,
                        }}
                      >
                        (N)
                      </span>
                    )}
                  </div>
                );
              })}
          </React.Fragment>
          );
        })}
      </div>

      {/* Draft legend */}
      {variant === 'draft' && (
        <div
          style={{
            margin: 16,
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.5,
            }}
          >
            <Trans i18nKey="sidebar.draftLegend" components={{ em: <em /> }} />
          </p>
        </div>
      )}

      {/* Bottom bar */}
      <div
        style={{
          height: 48,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0,
        }}
      >
        <Settings size={16} color="var(--text-faint)" style={{ cursor: 'pointer' }} />
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--surface-neutral)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              color: 'var(--text-muted-strong)',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1,
            }}
          >
            MR
          </span>
        </div>
      </div>
    </div>
  );
}
