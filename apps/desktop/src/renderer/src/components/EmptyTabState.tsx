import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyTabStateProps {
  onOpenFolder: () => void;
  lastFolderPath?: string | null | undefined;
  onResume?: () => void;
}

export function EmptyTabState({
  onOpenFolder,
  lastFolderPath,
  onResume,
}: EmptyTabStateProps): React.ReactElement {
  const lastFolderName = lastFolderPath
    ? lastFolderPath.split('/').filter(Boolean).pop() ?? lastFolderPath
    : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ fontSize: 13, color: '#8e8eaa', margin: 0, fontFamily: 'var(--font-sans)' }}>
        No folder open
      </p>

      {/* Quick-resume banner */}
      {lastFolderName && onResume && (
        <button
          onClick={onResume}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 44,
            padding: '0 18px',
            borderRadius: 10,
            border: '1px solid rgba(88,86,214,.25)',
            background: 'rgba(88,86,214,.05)',
            cursor: 'pointer',
            maxWidth: 360,
            width: '100%',
          }}
        >
          <FolderOpen size={16} color="#5856D6" style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#5856D6',
            fontFamily: 'var(--font-sans)',
            flex: 1,
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Continue with <strong>{lastFolderName}</strong>
          </span>
          <span style={{ fontSize: 11, color: '#8e8eaa', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
            Last opened
          </span>
        </button>
      )}

      <button
        onClick={onOpenFolder}
        style={{
          padding: '8px 20px',
          borderRadius: 8,
          border: '1.5px dashed rgba(88,86,214,.4)',
          background: 'transparent',
          color: '#5856D6',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Open Folder…
      </button>
    </div>
  );
}
