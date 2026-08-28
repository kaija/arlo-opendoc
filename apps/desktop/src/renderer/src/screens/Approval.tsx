import React from 'react';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';
import { ChevronRight, X, ArrowUp, FileText, Check } from 'lucide-react';

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
        <div
          style={{
            paddingLeft: 17,
            marginTop: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {details.map((d) => (
            <span
              key={d}
              style={{ fontSize: 11.5, color: '#8e8eaa', fontFamily: 'var(--font-sans)' }}
            >
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const DIFF_LINES: Array<{ type: 'add' | 'remove' | 'context'; text: string }> = [
  { type: 'context', text: '' },
  { type: 'add', text: '### Idempotency-key missing on retry' },
  { type: 'add', text: '' },
  {
    type: 'add',
    text: 'Clients that retry a failed charge without including an `Idempotency-Key`',
  },
  {
    type: 'add',
    text: 'header will generate a duplicate charge. This was the root cause of INC-2291.',
  },
  { type: 'add', text: '' },
  { type: 'add', text: '**Detection:** `payments.duplicate_charge` alert fires.' },
  { type: 'add', text: '**Fix:** Reject requests missing `Idempotency-Key`. See [ADR-014].' },
  { type: 'context', text: '' },
  { type: 'context', text: '### Gateway timeout on peak traffic' },
];

function DiffLine({
  line,
}: {
  line: (typeof DIFF_LINES)[number];
}): React.ReactElement {
  const bgMap = {
    add: '#eefaf4',
    remove: '#fdf0f2',
    context: 'transparent',
  };
  const markerMap = {
    add: '+',
    remove: '-',
    context: ' ',
  };
  const markerBgMap = {
    add: '#d6f2e4',
    remove: '#f7d7dd',
    context: 'transparent',
  };

  return (
    <div
      style={{
        display: 'flex',
        background: bgMap[line.type],
        height: 20,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          background: markerBgMap[line.type],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: line.type === 'add' ? '#1f9d6b' : line.type === 'remove' ? '#d1435b' : '#8e8eaa',
          flexShrink: 0,
        }}
      >
        {markerMap[line.type]}
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          color: '#52526b',
          paddingLeft: 6,
          whiteSpace: 'pre',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {line.text}
      </span>
    </div>
  );
}

function ApprovalCard(): React.ReactElement {
  return (
    <div
      style={{
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
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
          Arlo wants to edit this note
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: '#f0f0f8',
            borderRadius: 6,
            padding: '4px 8px',
          }}
        >
          <FileText size={12} color="#8e8eaa" />
          <span
            style={{
              fontSize: 11.5,
              color: '#52526b',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Payments service runbook
          </span>
        </div>
      </div>

      {/* Diff view */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,.06)',
          borderBottom: '1px solid rgba(0,0,0,.06)',
          maxHeight: 180,
          overflowY: 'auto',
        }}
      >
        {DIFF_LINES.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </div>

      {/* Card footer */}
      <div style={{ padding: '10px 14px' }}>
        <p
          style={{
            fontSize: 11,
            color: '#8e8eaa',
            fontFamily: 'var(--font-sans)',
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          Arlo drafted this change. Review the diff before approving — you can always edit
          after.
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,.1)',
              background: '#fff',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: '#d1435b',
              cursor: 'pointer',
            }}
          >
            Decline
          </button>
          <button
            style={{
              flex: 1,
              height: 28,
              borderRadius: 6,
              border: 'none',
              background: '#5856D6',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Check size={12} color="#fff" />
            Approve
          </button>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: '#8e8eaa',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(142,142,170,.4)',
            }}
          >
            Always allow · this draft only
          </span>
        </div>
      </div>
    </div>
  );
}

function ApprovalChatPanel(): React.ReactElement {
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 7px',
            background: 'rgba(192,122,18,.08)',
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#c07a12',
              display: 'block',
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: '#c07a12',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
            }}
          >
            needs your approval
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

        <ToolCallCard
          label="Searched knowledge base — 4 results"
          details={['INC-2291 postmortem', 'ADR-014: Idempotency strategy']}
        />
        <ToolCallCard label="Read Payments service runbook" details={[]} />

        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.65,
            color: '#1a1a2e',
            fontFamily: 'var(--font-sans)',
            marginBottom: 4,
          }}
        >
          INC-2291 was caused by clients retrying charges without an idempotency key. Here is
          the section I would add under Failure modes.
        </div>

        <ApprovalCard />
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(0,0,0,.06)',
          padding: '10px 12px',
          flexShrink: 0,
        }}
      >
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
              background: '#c07a12',
              display: 'block',
              flexShrink: 0,
            }}
          />
          Draft: Payments runbook refresh
        </div>
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
    </div>
  );
}

export function Approval(): React.ReactElement {
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
        draftStatus="needs-approval"
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
        publishEnabled={false}
        chatActive={true}
        onChatToggle={() => undefined}
        onPublish={() => undefined}
        onSearchClick={() => undefined}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar variant="draft" activeNoteId="payments" />
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
                fontFamily: 'var(--font-sans)',
              }}
            >
              The following failure modes have been observed in production. Each entry
              includes root cause, detection signals, and recommended remediation steps.
            </p>
          </div>
        </div>
        <ApprovalChatPanel />
      </div>
    </div>
  );
}
