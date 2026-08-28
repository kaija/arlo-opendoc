import React from 'react';

interface OutlineItem {
  id: string;
  label: string;
  indent: number;
  isActive?: boolean;
}

const OUTLINE_ITEMS: OutlineItem[] = [
  { id: 'escalation', label: 'Escalation path', indent: 0 },
  { id: 'failure-modes', label: 'Failure modes', indent: 0 },
  { id: 'gateway-timeout', label: 'Gateway timeout on peak traffic', indent: 1 },
  {
    id: 'duplicate-charge',
    label: 'Duplicate charge on client retry',
    indent: 1,
    isActive: true,
  },
  { id: 'idempotency-key', label: 'Idempotency-key missing on retry', indent: 1 },
  { id: 'webhook', label: 'Webhook delivery failure', indent: 1 },
  { id: 'recovery', label: 'Recovery procedures', indent: 0 },
];

const MARKDOWN_LINES: Array<{
  type: 'heading' | 'blank' | 'text' | 'bold' | 'code' | 'link-line';
  content: string;
}> = [
  { type: 'heading', content: '## Failure modes' },
  { type: 'blank', content: '' },
  {
    type: 'text',
    content:
      'The following failure modes have been observed in production. Each entry includes',
  },
  {
    type: 'text',
    content:
      'root cause, detection signals, and recommended remediation steps.',
  },
  { type: 'blank', content: '' },
  { type: 'heading', content: '### Gateway timeout on peak traffic' },
  { type: 'blank', content: '' },
  {
    type: 'text',
    content: 'Observed during Black Friday and end-of-quarter billing runs. The payments',
  },
  {
    type: 'text',
    content: 'service hits its upstream Stripe rate limit at approximately 400 req/s.',
  },
  { type: 'blank', content: '' },
  { type: 'bold', content: '**Detection:** `payments.latency_p99` alert fires above 2 s.' },
  { type: 'bold', content: '**Fix:** Enable request queuing in the gateway config.' },
  { type: 'blank', content: '' },
  { type: 'heading', content: '### Duplicate charge on client retry' },
  { type: 'blank', content: '' },
  {
    type: 'text',
    content: 'Clients that retry a timed-out charge without preserving state may generate',
  },
  { type: 'text', content: 'a duplicate transaction. See [INC-2291 postmortem].' },
  { type: 'blank', content: '' },
  { type: 'heading', content: '### Idempotency-key missing on retry' },
  { type: 'blank', content: '' },
  {
    type: 'text',
    content: 'Clients retrying charges without an `Idempotency-Key` header will generate',
  },
  {
    type: 'text',
    content: 'duplicate charges. This was the root cause of INC-2291.',
  },
  { type: 'blank', content: '' },
  { type: 'bold', content: '**Detection:** `payments.duplicate_charge` alert fires.' },
  { type: 'bold', content: '**Fix:** Reject requests missing `Idempotency-Key`. See [ADR-014].' },
];

function MarkdownLine({
  line,
  isCursorLine,
}: {
  line: (typeof MARKDOWN_LINES)[number];
  isCursorLine: boolean;
}): React.ReactElement {
  const baseStyle: React.CSSProperties = {
    fontSize: 13.5,
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.85,
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  if (line.type === 'blank') {
    return (
      <div style={{ ...baseStyle, height: '1.85em' }}>
        {isCursorLine && (
          <span
            className="cursor"
            style={{
              display: 'inline-block',
              width: 1.5,
              height: 13,
              background: '#5856D6',
              verticalAlign: 'text-bottom',
            }}
          />
        )}
      </div>
    );
  }

  if (line.type === 'heading') {
    // Split: `## ` or `### ` marker vs heading text
    const match = line.content.match(/^(#{1,6}\s)(.*)$/);
    if (match) {
      return (
        <div style={baseStyle}>
          <span style={{ color: '#8e8eaa' }}>{match[1]}</span>
          <span style={{ color: '#5856D6' }}>
            {match[2]}
            {isCursorLine && (
              <span
                className="cursor"
                style={{
                  display: 'inline-block',
                  width: 1.5,
                  height: 13,
                  background: '#5856D6',
                  verticalAlign: 'text-bottom',
                  marginLeft: 1,
                }}
              />
            )}
          </span>
        </div>
      );
    }
  }

  if (line.type === 'bold') {
    // Render **bold** markers in muted, bold text in normal
    const parts = line.content.split(/(\*\*[^*]*\*\*|`[^`]+`|\[.*?\])/g);
    return (
      <div style={baseStyle}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <React.Fragment key={i}>
                <span style={{ color: '#8e8eaa' }}>**</span>
                <span style={{ color: '#1a1a2e', fontWeight: 600 }}>
                  {part.slice(2, -2)}
                </span>
                <span style={{ color: '#8e8eaa' }}>**</span>
              </React.Fragment>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <span
                key={i}
                style={{
                  background: '#f0f0f8',
                  color: '#52526b',
                  borderRadius: 3,
                  padding: '0 3px',
                }}
              >
                {part}
              </span>
            );
          }
          if (part.startsWith('[') && part.endsWith(']')) {
            return (
              <span key={i} style={{ color: '#5856D6' }}>
                {part}
              </span>
            );
          }
          return (
            <span key={i} style={{ color: '#1a1a2e' }}>
              {part}
            </span>
          );
        })}
        {isCursorLine && (
          <span
            className="cursor"
            style={{
              display: 'inline-block',
              width: 1.5,
              height: 13,
              background: '#5856D6',
              verticalAlign: 'text-bottom',
              marginLeft: 1,
            }}
          />
        )}
      </div>
    );
  }

  // Plain text with inline code and link rendering
  const parts = line.content.split(/(`[^`]+`|\[.*?\])/g);
  return (
    <div style={{ ...baseStyle, color: '#1a1a2e' }}>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <span
              key={i}
              style={{
                background: '#f0f0f8',
                color: '#52526b',
                borderRadius: 3,
                padding: '0 3px',
              }}
            >
              {part}
            </span>
          );
        }
        if (part.startsWith('[') && part.endsWith(']')) {
          return (
            <span key={i} style={{ color: '#5856D6' }}>
              {part}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: '#1a1a2e' }}>
            {part}
          </span>
        );
      })}
      {isCursorLine && (
        <span
          className="cursor"
          style={{
            display: 'inline-block',
            width: 1.5,
            height: 13,
            background: '#5856D6',
            verticalAlign: 'text-bottom',
            marginLeft: 1,
          }}
        />
      )}
    </div>
  );
}

export function MarkdownEditor(): React.ReactElement {
  const cursorLineIndex = MARKDOWN_LINES.findIndex(
    (l) => l.content.includes('Idempotency-key missing'),
  );

  return (
    <div style={{ flex: 1, display: 'flex' }}>
      {/* Left panel — monospace editor */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '36px 40px',
        }}
      >
        <div style={{ maxWidth: 680 }}>
          {MARKDOWN_LINES.map((line, i) => (
            <MarkdownLine
              key={i}
              line={line}
              isCursorLine={i === cursorLineIndex}
            />
          ))}
        </div>
      </div>

      {/* Right panel — Outline */}
      <div
        style={{
          width: 186,
          borderLeft: '1px solid rgba(0,0,0,.06)',
          background: '#fafafa',
          padding: '16px 12px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            color: '#8e8eaa',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 10,
          }}
        >
          Outline
        </div>
        {OUTLINE_ITEMS.map((item) => (
          <div
            key={item.id}
            style={{
              paddingLeft: item.indent * 12,
              paddingTop: 3,
              paddingBottom: 3,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: item.isActive ? 500 : 400,
                color: item.isActive ? '#5856D6' : '#64648c',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.5,
                cursor: 'pointer',
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
