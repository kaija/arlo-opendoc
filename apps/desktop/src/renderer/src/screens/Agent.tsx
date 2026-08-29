import React from 'react';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';
import { ChevronRight, X, RotateCcw, ArrowUp } from 'lucide-react';

function Cursor(): React.ReactElement {
  return (
    <span
      className="cursor"
      style={{
        display: 'inline-block',
        width: 1.5,
        height: 13,
        background: '#5856D6',
        marginLeft: 1,
        verticalAlign: 'text-bottom',
      }}
    />
  );
}

function ChatPanel(): React.ReactElement {
  return (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        background: '#fff',
        borderLeft: '1px solid rgba(0,0,0,.08)',
        borderRadius: '12px 0 0 12px',
        boxShadow: '-10px 0 24px rgba(0,0,0,.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          borderBottom: '1px solid rgba(0,0,0,.06)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: '#1a1a2e',
            fontFamily: 'var(--font-sans)',
            flex: 1,
          }}
        >
          Arlo
        </span>
        {/* Status badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 7px',
            background: 'rgba(88,86,214,.06)',
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#5856D6',
              display: 'block',
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: '#5856D6',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
            }}
          >
            working
          </span>
        </div>
        <button
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
        >
          <X size={14} color="#8e8eaa" />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
        }}
      >
        {/* User message */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div
            style={{
              maxWidth: 300,
              background: '#f0f0f8',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12.5,
              lineHeight: 1.55,
              color: '#1a1a2e',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Add a section on the idempotency-key failure mode from INC-2291 last week, and
            link it from the failure modes list.
          </div>
        </div>

        {/* Tool call 1 */}
        <ToolCallCard
          label="Searched knowledge base — 4 results"
          details={['INC-2291 postmortem', 'ADR-014: Idempotency strategy']}
        />

        {/* Tool call 2 */}
        <ToolCallCard label="Read Payments service runbook" details={[]} />

        {/* Arlo response */}
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.65,
            color: '#1a1a2e',
            fontFamily: 'var(--font-sans)',
          }}
        >
          I found the relevant context from INC-2291 and ADR-014. Adding a new section under
          Failure modes now — this will cover the idempotency-key scenario and link back to
          the postmortem.
          <Cursor />
        </div>
      </div>

      {/* Footer */}
      <ChatFooter draftLabel="Payments runbook refresh" />
    </div>
  );
}

function ToolCallCard({
  label,
  details,
}: {
  label: string;
  details: string[];
}): React.ReactElement {
  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,.06)',
        borderRadius: 8,
        padding: '9px 11px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 11.5,
          color: '#52526b',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
        }}
      >
        <ChevronRight size={12} color="#a8a8be" style={{ flexShrink: 0 }} />
        {label}
      </div>
      {details.length > 0 && (
        <div style={{ paddingLeft: 17, marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {details.map((d) => (
            <span
              key={d}
              style={{
                fontSize: 11.5,
                color: '#8e8eaa',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatFooter({ draftLabel }: { draftLabel: string }): React.ReactElement {
  return (
    <div
      style={{
        borderTop: '1px solid rgba(0,0,0,.06)',
        padding: '10px 12px',
        flexShrink: 0,
      }}
    >
      {/* Draft pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 8,
          fontSize: 11.5,
          color: '#52526b',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#5856D6',
            display: 'block',
            flexShrink: 0,
          }}
        />
        Draft: {draftLabel}
      </div>
      {/* Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#f8f8fc',
          border: '1px solid rgba(0,0,0,.08)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 12.5,
            color: '#8e8eaa',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Ask Arlo…
        </span>
        <button
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#5856D6',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ArrowUp size={13} color="#fff" />
        </button>
      </div>
    </div>
  );
}

export { ToolCallCard, ChatFooter };

export function Agent(): React.ReactElement {
  const tabs = [
    { id: 't1', title: 'Payments service runbook', type: 'document' as const },
    { id: 't2', title: 'ADR-014: Idempotency strategy', type: 'document' as const },
    { id: 't3', title: 'idempotency key retry', type: 'search' as const },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}
    >
      <TitleBar
        draftStatus="working"
        draftName="Payments runbook refresh"
        tabs={tabs}
        activeTabId="t1"
        onTabClick={() => undefined}
        onNewTab={() => undefined}
      />
      <Toolbar
        breadcrumb={['Runbooks', 'Payments service runbook']}
        activeMode="preview"
        onModeChange={() => undefined}
        publishEnabled={true}
        chatActive={true}
        onChatToggle={() => undefined}
        onPublish={() => undefined}
        onSearchClick={() => undefined}
        showDiffTab={false}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar variant="draft" activeNoteId="payments" />
        <AgentDocumentView />
        <ChatPanel />
      </div>
    </div>
  );
}

function AgentDocumentView(): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: '#fff',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720, padding: '48px 40px' }}>
        <h2
          style={{
            fontSize: 19,
            fontWeight: 600,
            color: '#1a1a2e',
            letterSpacing: '-0.015em',
            marginBottom: 12,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Failure modes
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: '#1a1a2e',
            maxWidth: '68ch',
            marginBottom: 24,
            fontFamily: 'var(--font-sans)',
          }}
        >
          The following failure modes have been observed in production. Each entry includes
          root cause, detection signals, and recommended remediation steps. Refer to linked
          postmortems for historical context.
        </p>

        {[
          'Gateway timeout on peak traffic',
          'Duplicate charge on client retry',
          'Webhook delivery failure',
        ].map((title) => (
          <div key={title} style={{ marginBottom: 20 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#1a1a2e',
                fontFamily: 'var(--font-sans)',
                marginBottom: 6,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: '#64648c',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Observed during high-traffic events. Monitor alert{' '}
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  background: '#f0f0f8',
                  padding: '1px 4px',
                  borderRadius: 3,
                }}
              >
                payments.latency_p99
              </code>{' '}
              and escalate according to severity matrix.
            </p>
          </div>
        ))}

        {/* Writing indicator */}
        <div
          style={{
            marginTop: 16,
            height: 2,
            width: 40,
            background: 'linear-gradient(90deg, #5856D6, transparent)',
            borderRadius: 999,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

// Suppress unused import warning
void RotateCcw;
