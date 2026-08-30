import React, { useEffect, useRef } from 'react';

interface MarkdownEditorProps {
  content?: string | null;
  isSaving?: boolean | undefined;
  saveError?: string | null | undefined;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export function MarkdownEditor({
  content,
  isSaving,
  saveError,
  onChange,
  onSave,
}: MarkdownEditorProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Register Cmd+S / Ctrl+S keydown on the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  const placeholder = content == null
    ? 'No file open — double-click any text or code file in the sidebar to edit it.'
    : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-card)', position: 'relative' }}>
      <textarea
        ref={textareaRef}
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
          color: 'var(--text-body)',
          background: 'transparent',
          caretColor: 'var(--color-accent)',
        }}
      />

    </div>
  );
}
