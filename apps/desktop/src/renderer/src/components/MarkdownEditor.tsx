import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface MarkdownEditorProps {
  content?: string | null;
  isSaving?: boolean | undefined;
  saveError?: string | null | undefined;
  onChange?: (value: string) => void;
  onSave?: () => void;
  /** Settings > Editor > Typography. Empty family falls back to the mono stack. */
  fontFamily?: string | undefined;
  fontSize?: number | undefined;
  /** Measure in ch. Undefined leaves the textarea full width. */
  lineWidth?: number | undefined;
  wrapLines?: boolean | undefined;
  lineNumbers?: boolean | undefined;
}

export function MarkdownEditor({
  content,
  isSaving,
  saveError,
  onChange,
  onSave,
  fontFamily,
  fontSize,
  lineWidth,
  wrapLines,
  lineNumbers,
}: MarkdownEditorProps): React.ReactElement {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // The gutter is a separate element, so it has to follow the textarea's
  // scroll. Wrapped lines would desynchronise the two, which is why the
  // gutter is only offered while wrapping is off.
  const showGutter = lineNumbers === true && wrapLines === false;

  useEffect(() => {
    const el = textareaRef.current;
    const gutter = gutterRef.current;
    if (el === null || gutter === null || !showGutter) return;
    const sync = (): void => {
      gutter.scrollTop = el.scrollTop;
    };
    el.addEventListener('scroll', sync);
    return () => el.removeEventListener('scroll', sync);
  }, [showGutter]);

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

  const editorFont =
    fontFamily !== undefined && fontFamily.trim() !== ''
      ? `${fontFamily}, var(--font-mono)`
      : 'var(--font-mono)';
  const editorSize = fontSize ?? 13.5;
  const lineCount = (content ?? '').split('\n').length;

  const placeholder = content == null ? t('markdownEditor.placeholder') : '';

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--surface-card)', position: 'relative' }}>
      {showGutter && (
        <div
          ref={gutterRef}
          aria-hidden
          style={{
            flex: 'none',
            overflow: 'hidden',
            padding: '36px 10px 36px 20px',
            textAlign: 'right',
            fontFamily: editorFont,
            fontSize: editorSize,
            lineHeight: 1.75,
            color: 'var(--text-dim)',
            background: 'var(--surface-section)',
            borderRight: '1px solid var(--border)',
            userSelect: 'none',
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={content ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        // `wrap` is an attribute rather than CSS: turning it off must also
        // stop the textarea inserting soft line breaks into copied text.
        wrap={wrapLines === false ? 'off' : 'soft'}
        style={{
          flex: 1,
          resize: 'none',
          border: 'none',
          outline: 'none',
          padding: showGutter ? '36px 40px 36px 16px' : '36px 40px',
          // An empty family means "use the platform mono stack".
          fontFamily: editorFont,
          fontSize: editorSize,
          lineHeight: 1.75,
          color: 'var(--text-body)',
          background: 'transparent',
          caretColor: 'var(--color-accent)',
          whiteSpace: wrapLines === false ? 'pre' : 'pre-wrap',
          overflowX: wrapLines === false ? 'auto' : 'hidden',
          ...(lineWidth !== undefined ? { maxWidth: `${lineWidth}ch` } : {}),
        }}
      />

    </div>
  );
}
