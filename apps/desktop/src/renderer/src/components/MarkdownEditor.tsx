import React from 'react';

interface MarkdownEditorProps {
  content?: string | null;
  onChange?: (value: string) => void;
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps): React.ReactElement {
  const placeholder = content == null
    ? 'No file open — double-click a .md or .txt file in the sidebar to edit it.'
    : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <textarea
        value={content ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          flex: 1,
          resize: 'none',
          border: 'none',
          outline: 'none',
          padding: '36px 40px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13.5,
          lineHeight: 1.75,
          color: '#1a1a2e',
          background: 'transparent',
          caretColor: '#5856D6',
        }}
      />
    </div>
  );
}
