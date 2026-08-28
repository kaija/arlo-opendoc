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
      background: 'rgba(192,122,18,.09)',
      color: '#c07a12',
    };
  }
  return {
    background: '#f0f0f8',
    color: '#64648c',
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
          color: '#64648c',
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
        color: '#64648c',
        fontFamily: 'var(--font-sans)',
        lineHeight: 1.55,
      }}
    >
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              background: '#fdf6d8',
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
          background: 'rgba(26,26,46,.28)',
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
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.10)',
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
            borderBottom: '1px solid rgba(0,0,0,.08)',
            flexShrink: 0,
          }}
        >
          <SearchIcon size={16} color="#8e8eaa" style={{ flexShrink: 0 }} />
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              color: '#1a1a2e',
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
                background: '#5856D6',
                marginLeft: 1,
                verticalAlign: 'text-bottom',
              }}
            />
          </div>
          <span
            style={{
              background: '#f0f0f8',
              border: '1px solid rgba(0,0,0,.06)',
              borderRadius: 4,
              padding: '3px 7px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: '#8e8eaa',
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
            borderBottom: '1px solid rgba(0,0,0,.06)',
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
                border: '1px solid rgba(0,0,0,.08)',
                background: i === 0 ? '#f0f0f8' : '#fff',
                fontSize: 11.5,
                fontWeight: i === 0 ? 500 : 400,
                color: i === 0 ? '#1a1a2e' : '#64648c',
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
                background: i === 0 ? '#f8f8fc' : 'transparent',
                borderBottom: i < RESULTS.length - 1 ? '1px solid rgba(0,0,0,.04)' : undefined,
                cursor: 'pointer',
              }}
            >
              {/* Left: text content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#1a1a2e',
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
                    color: '#8e8eaa',
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
            background: '#f8f8fc',
            borderTop: '1px solid rgba(0,0,0,.06)',
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
              color: '#8e8eaa',
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
                background: '#f0f0f8',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '80%',
                  height: '100%',
                  background: '#5856D6',
                  borderRadius: 999,
                }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                color: '#8e8eaa',
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
