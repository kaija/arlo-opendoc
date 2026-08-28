import React from 'react';
import { RotateCcw } from 'lucide-react';

interface DiffRow {
  type: 'add' | 'remove' | 'context';
  leftText: string | null;
  rightText: string | null;
}

const DIFF_ROWS: DiffRow[] = [
  { type: 'context', leftText: '## Failure modes', rightText: '## Failure modes' },
  { type: 'context', leftText: '', rightText: '' },
  {
    type: 'context',
    leftText: 'The following failure modes have been observed',
    rightText: 'The following failure modes have been observed',
  },
  {
    type: 'context',
    leftText: 'in production.',
    rightText: 'in production.',
  },
  { type: 'context', leftText: '', rightText: '' },
  {
    type: 'context',
    leftText: '- Gateway timeout on peak traffic',
    rightText: '- Gateway timeout on peak traffic',
  },
  {
    type: 'remove',
    leftText: '- Duplicate charge on client retry',
    rightText: null,
  },
  {
    type: 'add',
    leftText: null,
    rightText: '- Duplicate charge on client retry',
  },
  {
    type: 'add',
    leftText: null,
    rightText: '- Idempotency-key missing on retry ← new',
  },
  {
    type: 'context',
    leftText: '- Webhook delivery failure',
    rightText: '- Webhook delivery failure',
  },
  { type: 'context', leftText: '', rightText: '' },
  {
    type: 'context',
    leftText: '### Duplicate charge on client retry',
    rightText: '### Duplicate charge on client retry',
  },
  { type: 'context', leftText: '', rightText: '' },
  {
    type: 'remove',
    leftText: 'Observed when a client retries without state.',
    rightText: null,
  },
  {
    type: 'add',
    leftText: null,
    rightText: 'Observed when a client retries a failed charge',
  },
  {
    type: 'add',
    leftText: null,
    rightText: 'without an idempotency key. See INC-2291.',
  },
  { type: 'context', leftText: '', rightText: '' },
  {
    type: 'add',
    leftText: null,
    rightText: '### Idempotency-key missing on retry',
  },
  {
    type: 'add',
    leftText: null,
    rightText: '',
  },
  {
    type: 'add',
    leftText: null,
    rightText: 'Clients retrying charges without `Idempotency-Key`',
  },
  {
    type: 'add',
    leftText: null,
    rightText: 'header generate duplicate charges. Root cause of',
  },
  {
    type: 'add',
    leftText: null,
    rightText: 'INC-2291. See [ADR-014] for enforcement policy.',
  },
  { type: 'context', leftText: '', rightText: '' },
  {
    type: 'context',
    leftText: '### Webhook delivery failure',
    rightText: '### Webhook delivery failure',
  },
];

const ROW_HEIGHT = 21;

function DiffColumn({
  side,
  showUndoButton,
}: {
  side: 'left' | 'right';
  showUndoButton: boolean;
}): React.ReactElement {
  const rows = DIFF_ROWS.map((row) => {
    if (side === 'left') {
      if (row.type === 'add') return { type: 'empty' as const, text: '' };
      return { type: row.type as 'remove' | 'context', text: row.leftText ?? '' };
    } else {
      if (row.type === 'remove') return { type: 'empty' as const, text: '' };
      return { type: row.type as 'add' | 'context', text: row.rightText ?? '' };
    }
  });

  // find first "add" block position for undo button
  const firstAddIndex = rows.findIndex((r) => r.type === 'add');

  return (
    <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
      {rows.map((row, i) => {
        const bgMap: Record<string, string> = {
          add: '#eefaf4',
          remove: '#fdf0f2',
          context: 'transparent',
          empty: side === 'left' ? '#fdf0f2' : '#eefaf4',
        };
        const markerMap: Record<string, string> = {
          add: '+',
          remove: '-',
          context: ' ',
          empty: side === 'left' ? '-' : '+',
        };
        const markerBgMap: Record<string, string> = {
          add: '#d6f2e4',
          remove: '#f7d7dd',
          context: 'transparent',
          empty: side === 'left' ? '#f7d7dd' : '#d6f2e4',
        };
        const markerColorMap: Record<string, string> = {
          add: '#1f9d6b',
          remove: '#d1435b',
          context: 'transparent',
          empty: side === 'left' ? '#d1435b' : '#1f9d6b',
        };

        const isEmptyType = row.text === '' && row.type === 'context';

        return (
          <div
            key={i}
            style={{
              height: ROW_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              background: isEmptyType ? 'transparent' : bgMap[row.type],
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 20,
                height: ROW_HEIGHT,
                background: isEmptyType ? 'transparent' : markerBgMap[row.type],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: isEmptyType ? 'transparent' : markerColorMap[row.type],
                flexShrink: 0,
              }}
            >
              {isEmptyType ? ' ' : markerMap[row.type]}
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
                color: '#52526b',
                paddingLeft: 6,
                paddingRight: 8,
                whiteSpace: 'pre',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {row.text}
            </span>

            {/* Undo button on first add row in right column */}
            {showUndoButton && side === 'right' && i === firstAddIndex && (
              <div
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,.10)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,.08)',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: '#52526b',
                  zIndex: 2,
                }}
              >
                <RotateCcw size={11} color="#8e8eaa" />
                Undo this change
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DiffView(): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar (44px) */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
          borderBottom: '1px solid rgba(0,0,0,.08)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#1a1a2e',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Payments service runbook
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#c07a12',
            background: 'rgba(192,122,18,.09)',
            borderRadius: 4,
            padding: '2px 6px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          (M)
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontFamily: 'var(--font-mono)',
            color: '#1f9d6b',
          }}
        >
          +18
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontFamily: 'var(--font-mono)',
            color: '#d1435b',
          }}
        >
          -2
        </span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 12,
            color: '#64648c',
            fontFamily: 'var(--font-sans)',
          }}
        >
          4 notes changed in Payments runbook refresh
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontFamily: 'var(--font-mono)',
            color: '#1f9d6b',
          }}
        >
          +32
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontFamily: 'var(--font-mono)',
            color: '#d1435b',
          }}
        >
          -3
        </span>
      </div>

      {/* Column headers (30px) */}
      <div
        style={{
          height: 30,
          display: 'flex',
          background: '#f8f8fc',
          borderBottom: '1px solid rgba(0,0,0,.06)',
          flexShrink: 0,
        }}
      >
        {['Live', 'This draft'].map((label) => (
          <div
            key={label}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 26,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: '#8e8eaa',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRight: label === 'Live' ? '1px solid rgba(0,0,0,.06)' : undefined,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Two-column diff */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRight: '1px solid rgba(0,0,0,.06)',
          }}
        >
          <DiffColumn side="left" showUndoButton={false} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <DiffColumn side="right" showUndoButton={true} />
        </div>
      </div>
    </div>
  );
}
