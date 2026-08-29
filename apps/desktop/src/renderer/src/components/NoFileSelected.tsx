import React from 'react';
import { FileText } from 'lucide-react';

export function NoFileSelected(): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#fff',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: '#f0f0f8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FileText size={22} color="#a8a8be" />
      </div>
      <p
        style={{
          fontSize: 13,
          color: '#a8a8be',
          fontFamily: 'var(--font-sans)',
          margin: 0,
          fontWeight: 400,
        }}
      >
        Select a file to preview
      </p>
    </div>
  );
}
