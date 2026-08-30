import React from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Reading } from './Reading';

interface SearchResult {
  id: string;
  title: string;
  breadcrumb: string;
  excerpt: string;
  matchTerms: string[];
  badges: Array<{ label: string; variant: 'changed' | 'semantic' | 'exact' | 'exactSemantic' }>;
}

const RESULTS: SearchResult[] = [
  {
    id: 'r1',
    title: 'Payments service runbook',
    breadcrumb: 'Runbooks › Failure modes › Duplicate charge on client retry',
    excerpt: 'Clients that retry a failed charge without including an idempotency key will generate a duplicate…',
    matchTerms: ['idempotency key'],
    badges: [
      { label: 'Changed in this draft', variant: 'changed' },
      { label: 'Exact + meaning', variant: 'exactSemantic' },
    ],
  },
  {
    id: 'r2',
    title: 'ADR-014: Idempotency strategy',
    breadcrumb: 'Architecture Decisions › Decision',
    excerpt: 'All mutating API endpoints must accept an Idempotency-Key header to prevent duplicate processing…',
    matchTerms: ['Idempotency-Key'],
    badges: [{ label: 'Meaning', variant: 'semantic' }],
  },
  {
    id: 'r3',
    title: 'API Reference — Payments',
    breadcrumb: 'API Reference › POST /charges',
    excerpt:
      'Required header: Idempotency-Key (string, UUID format). Requests without this header will be rejected…',
    matchTerms: ['Idempotency-Key'],
    badges: [{ label: 'Exact', variant: 'exact' }],
  },
  {
    id: 'r4',
    title: 'INC-2291 postmortem',
    breadcrumb: 'Incidents › Timeline',
    excerpt:
      'Root cause: payment client library v2.3.1 did not include idempotency key on automatic retries…',
    matchTerms: ['idempotency key'],
    badges: [{ label: 'Exact + meaning', variant: 'exactSemantic' }],
  },
  {
    id: 'r5',
    title: 'On-call handover',
    breadcrumb: 'Runbooks › Open questions',
    excerpt: 'Is the new idempotency-key enforcement backward-compatible with legacy clients? Needs answer…',
    matchTerms: ['idempotency-key'],
    badges: [{ label: 'Meaning', variant: 'semantic' }],
  },
];

const FILTER_PILLS = [
  'All notebooks',
  'Runbooks',
  'Architecture Decisions',
  'Incidents',
];

function badgeStyle(variant: SearchResult['badges'][number]['variant']): React.CSSProperties {
  if (variant === 'changed') {
    return {
      background: 'var(--color-warning-a09)',
      color: 'var(--color-warning)',
    };
  }
  return {
    background: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
  };
}

function HighlightedExcerpt({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}): React.ReactElement {
  // Simple highlight: split on matched terms (case-insensitive)
  if (terms.length === 0) {
    return (
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.55,
        }}
      >
        {text}
      </span>
    );
  }

  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return (
    <span
      style={{
        fontSize: 12,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.55,
      }}
    >
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              background: 'var(--color-warning-surface)',
              color: 'inherit',
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}

export function Search(): React.ReactElement {
  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Background: blurred Reading screen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          filter: 'blur(3px)',
          pointerEvents: 'none',
        }}
      >
        <Reading />
      </div>

      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-scrim)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 720,
          background: 'var(--surface-card)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-overlay)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Input row */}
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 16px',
            borderBottom: '1px solid var(--border-mid)',
            flexShrink: 0,
          }}
        >
          <SearchIcon size={16} color="var(--text-faint)" style={{ flexShrink: 0 }} />
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-body)',
              display: 'flex',
              alignItems: 'center',
              gap: 0,
            }}
          >
            <span>idempotency key retry</span>
            <span
              className="cursor"
              style={{
                display: 'inline-block',
                width: 1.5,
                height: 15,
                background: 'var(--color-accent)',
                marginLeft: 1,
                verticalAlign: 'text-bottom',
              }}
            />
          </div>
          <span
            style={{
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-faint)',
              flexShrink: 0,
            }}
          >
            Esc
          </span>
        </div>

        {/* Filter pills */}
        <div
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {FILTER_PILLS.map((pill, i) => (
            <button
              key={pill}
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 999,
                border: '1px solid var(--border-mid)',
                background: i === 0 ? 'var(--surface-sunken)' : 'var(--surface-card)',
                fontSize: 11.5,
                fontWeight: i === 0 ? 500 : 400,
                color: i === 0 ? 'var(--text-body)' : 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
              }}
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Results list */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {RESULTS.map((result, i) => (
            <div
              key={result.id}
              style={{
                padding: '11px 18px',
                display: 'flex',
                gap: 14,
                background: i === 0 ? 'var(--surface-section)' : 'transparent',
                borderBottom: i < RESULTS.length - 1 ? '1px solid var(--border-faint)' : undefined,
                cursor: 'pointer',
              }}
            >
              {/* Left: text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-body)',
                    fontFamily: 'var(--font-sans)',
                    marginBottom: 2,
                  }}
                >
                  {result.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-faint)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {result.breadcrumb}
                </div>
                <HighlightedExcerpt text={result.excerpt} terms={result.matchTerms} />
              </div>

              {/* Right: badges */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  flexShrink: 0,
                }}
              >
                {result.badges.map((badge) => (
                  <span
                    key={badge.label}
                    style={{
                      ...badgeStyle(badge.variant),
                      borderRadius: 999,
                      padding: '3px 8px',
                      fontSize: 10.5,
                      fontWeight: 500,
                      fontFamily: 'var(--font-sans)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            height: 40,
            background: 'var(--surface-section)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            1,284 notes · ↑↓ to navigate · ↵ to open
          </span>
          {/* Progress indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: 60,
                height: 3,
                background: 'var(--surface-sunken)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '80%',
                  height: '100%',
                  background: 'var(--color-accent)',
                  borderRadius: 999,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-faint)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              searching…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
