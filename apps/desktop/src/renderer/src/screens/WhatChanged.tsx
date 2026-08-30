import React from 'react';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';
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
          add: 'var(--color-success-surface)',
          remove: 'var(--color-danger-surface)',
          context: 'transparent',
          empty: side === 'left' ? 'var(--color-danger-surface)' : 'var(--color-success-surface)',
        };
        const markerMap: Record<string, string> = {
          add: '+',
          remove: '-',
          context: ' ',
          empty: side === 'left' ? '-' : '+',
        };
        const markerBgMap: Record<string, string> = {
          add: 'var(--color-success-surface-strong)',
          remove: 'var(--color-danger-surface-strong)',
          context: 'transparent',
          empty: side === 'left' ? 'var(--color-danger-surface-strong)' : 'var(--color-success-surface-strong)',
        };
        const markerColorMap: Record<string, string> = {
          add: 'var(--color-success)',
          remove: 'var(--color-danger)',
          context: 'transparent',
          empty: side === 'left' ? 'var(--color-danger)' : 'var(--color-success)',
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
                color: 'var(--text-muted-strong)',
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
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  boxShadow: '0 2px 8px var(--border-mid)',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--text-muted-strong)',
                  zIndex: 2,
                }}
              >
                <RotateCcw size={11} color="var(--text-faint)" />
                Undo this change
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WhatChanged(): React.ReactElement {
  const tabs = [
    { id: 't1', title: 'Payments service runbook', worktreePath: '', branch: 'main' },
    { id: 't2', title: 'ADR-014: Idempotency strategy', worktreePath: '', branch: 'main' },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-card)',
      }}
    >
      <TitleBar
        draftStatus="working"
        draftName="Payments runbook refresh"
        tabs={tabs}
        activeTabId="t1"
        onTabClick={() => undefined}
        onNewTab={() => undefined}
        onTabClose={() => undefined}
      />
      <Toolbar
        breadcrumb={['Runbooks', 'Payments service runbook']}
        activeMode="diff"
        onModeChange={() => undefined}
        publishEnabled={true}
        chatActive={false}
        onChatToggle={() => undefined}
        onPublish={() => undefined}
        onSearchClick={() => undefined}
        showDiffTab={true}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar variant="draft" activeNoteId="payments" />

        {/* Diff main area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Top header bar */}
          <div
            style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 16px',
              borderBottom: '1px solid var(--border-mid)',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Payments service runbook
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-warning)',
                background: 'var(--color-warning-a09)',
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
                color: 'var(--color-success)',
              }}
            >
              +18
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-danger)',
              }}
            >
              -2
            </span>
            <div style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              4 notes changed in Payments runbook refresh
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-success)',
              }}
            >
              +32
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-danger)',
              }}
            >
              -3
            </span>
          </div>

          {/* Column headers */}
          <div
            style={{
              height: 30,
              display: 'flex',
              background: 'var(--surface-section)',
              borderBottom: '1px solid var(--border)',
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
                  color: 'var(--text-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderRight: label === 'Live' ? '1px solid var(--border)' : undefined,
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
                borderRight: '1px solid var(--border)',
              }}
            >
              <DiffColumn side="left" showUndoButton={false} />
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <DiffColumn side="right" showUndoButton={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
