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
        border: '1px solid var(--border)',
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
          color: 'var(--text-muted-strong)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
        }}
      >
        <ChevronRight size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />
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
              style={{ fontSize: 11.5, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}
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
    add: 'var(--color-success-surface)',
    remove: 'var(--color-danger-surface)',
    context: 'transparent',
  };
  const markerMap = {
    add: '+',
    remove: '-',
    context: ' ',
  };
  const markerBgMap = {
    add: 'var(--color-success-surface-strong)',
    remove: 'var(--color-danger-surface-strong)',
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
          color: line.type === 'add' ? 'var(--color-success)' : line.type === 'remove' ? 'var(--color-danger)' : 'var(--text-faint)',
          flexShrink: 0,
        }}
      >
        {markerMap[line.type]}
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted-strong)',
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
        border: '1px solid var(--border-mid)',
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
            color: 'var(--text-body)',
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
            background: 'var(--surface-sunken)',
            borderRadius: 6,
            padding: '4px 8px',
          }}
        >
          <FileText size={12} color="var(--text-faint)" />
          <span
            style={{
              fontSize: 11.5,
              color: 'var(--text-muted-strong)',
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
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
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
            color: 'var(--text-faint)',
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
              border: '1px solid var(--border-strong)',
              background: 'var(--surface-card)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-danger)',
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
              background: 'var(--color-accent)',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-on-accent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Check size={12} style={{ color: 'var(--text-on-accent)' }} />
            Approve
          </button>
        </div>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: 'var(--text-decoration-faint)',
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
        background: 'var(--surface-card)',
        borderLeft: '1px solid var(--border-mid)',
        borderRadius: '12px 0 0 12px',
        boxShadow: '-10px 0 24px var(--border-mid)',
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
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text-body)',
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
            background: 'var(--color-warning-a08)',
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-warning)',
              display: 'block',
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-warning)',
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
          <X size={14} color="var(--text-faint)" />
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
              background: 'var(--surface-sunken)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--text-body)',
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
            color: 'var(--text-body)',
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
          borderTop: '1px solid var(--border)',
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
            color: 'var(--text-muted-strong)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-warning)',
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
            background: 'var(--surface-section)',
            border: '1px solid var(--border-mid)',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 12.5,
              color: 'var(--text-faint)',
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
              background: 'var(--color-accent)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowUp size={13} style={{ color: 'var(--text-on-accent)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Approval(): React.ReactElement {
  const tabs = [
    { id: 't1', title: 'Payments service runbook', worktreePath: '', branch: 'main' },
    { id: 't2', title: 'ADR-014: Idempotency strategy', worktreePath: '', branch: 'main' },
    { id: 't3', title: 'idempotency key retry', worktreePath: '', branch: 'main' },
  ];

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
        draftStatus="needs-approval"
        draftName="Payments runbook refresh"
        tabs={tabs}
        activeTabId="t1"
        onTabClick={() => undefined}
        onNewTab={() => undefined}
        onTabClose={() => undefined}
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
        showDiffTab={false}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar variant="draft" activeNoteId="payments" />
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--surface-card)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '100%', maxWidth: 720, padding: '48px 40px' }}>
            <h2
              style={{
                fontSize: 19,
                fontWeight: 600,
                color: 'var(--text-body)',
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
                color: 'var(--text-body)',
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
