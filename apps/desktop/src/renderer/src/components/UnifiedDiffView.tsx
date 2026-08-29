import React from 'react';

interface UnifiedDiffViewProps {
  diff: string | null;
}

export function UnifiedDiffView({ diff }: UnifiedDiffViewProps): React.ReactElement {
  if (!diff) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: '#8e8eaa', fontFamily: 'var(--font-sans)' }}>
          No changes to display
        </span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
      <pre
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre',
          color: '#1a1a2e',
        }}
      >
        {diff}
      </pre>
    </div>
  );
}
