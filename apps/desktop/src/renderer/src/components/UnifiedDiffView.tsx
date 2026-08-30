import React from 'react';

interface UnifiedDiffViewProps {
  diff: string | null;
}

// ── Diff parser ─────────────────────────────────────────────────────────────
// Converts a unified diff string into paired left/right rows for side-by-side
// display, matching the design spec layout.

type RowKind = 'context' | 'removed' | 'added' | 'hunk';

interface DiffRow {
  left:  { kind: RowKind; text: string } | null;
  right: { kind: RowKind; text: string } | null;
}

function parseDiff(raw: string): DiffRow[] {
  const lines = raw.split('\n');
  const rows: DiffRow[] = [];

  // Collect hunks — buffer removed and added lines, then pair them
  const removedBuf: string[] = [];
  const addedBuf: string[] = [];

  function flushBuffers() {
    const maxLen = Math.max(removedBuf.length, addedBuf.length);
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        left:  i < removedBuf.length ? { kind: 'removed', text: removedBuf[i]! } : null,
        right: i < addedBuf.length   ? { kind: 'added',   text: addedBuf[i]!   } : null,
      });
    }
    removedBuf.length = 0;
    addedBuf.length = 0;
  }

  for (const line of lines) {
    // Skip diff header lines (diff --git, index, ---, +++)
    if (
      line.startsWith('diff ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ')
    ) continue;

    if (line.startsWith('@@')) {
      flushBuffers();
      rows.push({ left: { kind: 'hunk', text: line }, right: { kind: 'hunk', text: line } });
      continue;
    }

    if (line.startsWith('-')) {
      removedBuf.push(line.slice(1));
      continue;
    }

    if (line.startsWith('+')) {
      addedBuf.push(line.slice(1));
      continue;
    }

    // Context line — flush pending removed/added first
    flushBuffers();
    const text = line.startsWith(' ') ? line.slice(1) : line;
    rows.push({
      left:  { kind: 'context', text },
      right: { kind: 'context', text },
    });
  }

  flushBuffers();

  // Remove trailing empty rows
  while (rows.length > 0) {
    const last = rows[rows.length - 1]!;
    const leftEmpty  = !last.left  || last.left.text.trim()  === '';
    const rightEmpty = !last.right || last.right.text.trim() === '';
    if (leftEmpty && rightEmpty) rows.pop();
    else break;
  }

  return rows;
}

// ── Row renderer ─────────────────────────────────────────────────────────────

const ROW_H = 21;
const GUTTER_W = 20;

const COLORS = {
  removed:   { gutter: 'var(--color-danger-surface-strong)', bg: 'var(--color-danger-surface)', symbol: '−', symbolColor: 'var(--color-danger-dim)' },
  added:     { gutter: 'var(--color-success-surface-strong)', bg: 'var(--color-success-surface)', symbol: '+', symbolColor: 'var(--color-success-dim)' },
  context:   { gutter: 'transparent', bg: 'var(--surface-card)', symbol: '', symbolColor: 'transparent' },
  hunk:      { gutter: 'var(--surface-sunken)', bg: 'var(--surface-section)', symbol: '@', symbolColor: 'var(--text-faint)' },
} as const;

function Cell({
  cell,
}: {
  cell: { kind: RowKind; text: string } | null;
}): React.ReactElement {
  if (!cell) {
    return (
      <div style={{ display: 'flex', height: ROW_H }}>
        <div style={{ width: GUTTER_W, flexShrink: 0, background: 'var(--surface-section)' }} />
        <div style={{ flex: 1, background: 'var(--surface-alt-soft)' }} />
      </div>
    );
  }

  const { gutter, bg, symbol, symbolColor } = COLORS[cell.kind];
  const isHunk = cell.kind === 'hunk';

  return (
    <div style={{ display: 'flex', height: ROW_H }}>
      {/* Gutter */}
      <div
        style={{
          width: GUTTER_W,
          flexShrink: 0,
          background: gutter,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          lineHeight: `${ROW_H}px`,
          fontWeight: 500,
          color: symbolColor,
          textAlign: 'center',
        }}
      >
        {symbol}
      </div>
      {/* Content */}
      <div
        style={{
          flex: 1,
          background: bg,
          padding: '0 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: isHunk ? 10 : 11.5,
          lineHeight: `${ROW_H}px`,
          color: isHunk ? 'var(--text-faint)' : 'var(--text-muted-strong)',
          whiteSpace: 'pre',
          overflow: 'hidden',
          fontWeight: isHunk ? 500 : 400,
        }}
      >
        {cell.text}
      </div>
    </div>
  );
}

// ── SideBySideDiffView ────────────────────────────────────────────────────────

export function UnifiedDiffView({ diff }: UnifiedDiffViewProps): React.ReactElement {
  if (!diff) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
          No changes to display
        </span>
      </div>
    );
  }

  const rows = parseDiff(diff);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)' }}>
      {/* Column headers */}
      <div
        style={{
          height: 30,
          flexShrink: 0,
          display: 'flex',
          background: 'var(--surface-section)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            flex: 1,
            padding: '0 12px',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 500,
            lineHeight: '30px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            borderRight: '1px solid var(--border)',
          }}
        >
          Live
        </div>
        <div
          style={{
            flex: 1,
            padding: '0 12px',
            fontFamily: 'var(--font-sans)',
            fontSize: 11,
            fontWeight: 500,
            lineHeight: '30px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
          }}
        >
          Working copy
        </div>
      </div>

      {/* Diff rows */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', flexShrink: 0 }}>
            {/* Left panel */}
            <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid var(--border)' }}>
              <Cell cell={row.left} />
            </div>
            {/* Right panel */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Cell cell={row.right} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
