import React from 'react';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';

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
              background: 'var(--color-accent)',
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
          <span style={{ color: 'var(--text-faint)' }}>{match[1]}</span>
          <span style={{ color: 'var(--color-accent)' }}>
            {match[2]}
            {isCursorLine && (
              <span
                className="cursor"
                style={{
                  display: 'inline-block',
                  width: 1.5,
                  height: 13,
                  background: 'var(--color-accent)',
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
                <span style={{ color: 'var(--text-faint)' }}>**</span>
                <span style={{ color: 'var(--text-body)', fontWeight: 600 }}>
                  {part.slice(2, -2)}
                </span>
                <span style={{ color: 'var(--text-faint)' }}>**</span>
              </React.Fragment>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <span
                key={i}
                style={{
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-muted-strong)',
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
              <span key={i} style={{ color: 'var(--color-accent)' }}>
                {part}
              </span>
            );
          }
          return (
            <span key={i} style={{ color: 'var(--text-body)' }}>
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
              background: 'var(--color-accent)',
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
    <div style={{ ...baseStyle, color: 'var(--text-body)' }}>
      {parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <span
              key={i}
              style={{
                background: 'var(--surface-sunken)',
                color: 'var(--text-muted-strong)',
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
            <span key={i} style={{ color: 'var(--color-accent)' }}>
              {part}
            </span>
          );
        }
        return (
          <span key={i} style={{ color: 'var(--text-body)' }}>
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
            background: 'var(--color-accent)',
            verticalAlign: 'text-bottom',
            marginLeft: 1,
          }}
        />
      )}
    </div>
  );
}

export function Editing(): React.ReactElement {
  const tabs = [
    { id: 't1', title: 'Payments service runbook', worktreePath: '', branch: 'main' },
  ];

  const cursorLineIndex = MARKDOWN_LINES.findIndex(
    (l) => l.content.includes('Idempotency-key missing'),
  );

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
        activeMode="edit"
        onModeChange={() => undefined}
        publishEnabled={true}
        chatActive={false}
        onChatToggle={() => undefined}
        onPublish={() => undefined}
        onSearchClick={() => undefined}
        showDiffTab={false}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <Sidebar variant="draft" activeNoteId="payments" />

        {/* Markdown editor */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--surface-card)',
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

        {/* Outline panel */}
        <div
          style={{
            width: 186,
            flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            background: 'var(--surface-alt)',
            padding: '16px 12px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-faint)',
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
                  color: item.isActive ? 'var(--color-accent)' : 'var(--text-muted)',
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
    </div>
  );
}
