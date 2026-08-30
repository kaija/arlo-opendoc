import React, { useState } from 'react'
import { X, ArrowUp, ChevronRight, FileText, Check } from 'lucide-react'
import { DraftStatus } from '../types'

interface ChatPanelProps {
  draftStatus: DraftStatus
  draftName: string
  lastApprovalResult: 'approved' | 'declined' | null
  onClose: () => void
  onNeedsApproval: () => void
  onApprove: () => void
  onDecline: () => void
}

// Copied verbatim from screens/Agent.tsx
function Cursor(): React.ReactElement {
  return (
    <span
      className="cursor"
      style={{
        display: 'inline-block',
        width: 1.5,
        height: 13,
        background: 'var(--color-accent)',
        marginLeft: 1,
        verticalAlign: 'text-bottom',
      }}
    />
  )
}

// Copied verbatim from screens/Agent.tsx
function ToolCallCard({
  label,
  details,
}: {
  label: string
  details: string[]
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
  )
}

// Copied verbatim from screens/Approval.tsx
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
]

// Copied verbatim from screens/Approval.tsx
function DiffLine({ line }: { line: (typeof DIFF_LINES)[number] }): React.ReactElement {
  const bgMap = {
    add: 'var(--color-success-surface)',
    remove: 'var(--color-danger-surface)',
    context: 'transparent',
  }
  const markerMap = {
    add: '+',
    remove: '-',
    context: ' ',
  }
  const markerBgMap = {
    add: 'var(--color-success-surface-strong)',
    remove: 'var(--color-danger-surface-strong)',
    context: 'transparent',
  }

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
          color:
            line.type === 'add' ? 'var(--color-success)' : line.type === 'remove' ? 'var(--color-danger)' : 'var(--text-faint)',
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
  )
}

function ApprovalCard({
  onApprove,
  onDecline,
}: {
  onApprove: () => void
  onDecline: () => void
}): React.ReactElement {
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
          Arlo drafted this change. Review the diff before approving — you can always edit after.
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={onDecline}
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
            onClick={onApprove}
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
  )
}

export function ChatPanel({
  draftStatus,
  draftName,
  lastApprovalResult,
  onClose,
  onNeedsApproval,
  onApprove,
  onDecline,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')

  return (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-card)',
        borderLeft: '1px solid var(--border-mid)',
        borderRadius: '12px 0 0 12px',
        boxShadow: '-10px 0 24px var(--border-mid)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-body)',
          }}
        >
          Arlo
        </span>

        {/* Status badge */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {draftStatus === 'working' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--color-accent-a06)',
                borderRadius: 20,
                padding: '3px 10px',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: 'var(--color-accent)',
                  fontWeight: 500,
                }}
              >
                working
              </span>
            </div>
          )}
          {draftStatus === 'needs-approval' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--color-warning-a08)',
                borderRadius: 20,
                padding: '3px 10px',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--color-warning)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: 'var(--color-warning)',
                  fontWeight: 500,
                }}
              >
                needs your approval
              </span>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--text-faint)',
            padding: 0,
          }}
        >
          <X size={16} />
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
        {/* User message bubble */}
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

        {/* Tool call cards */}
        <ToolCallCard
          label="Searched knowledge base — 4 results"
          details={['INC-2291 postmortem', 'ADR-014: Idempotency strategy']}
        />
        <ToolCallCard label="Read Payments service runbook" details={[]} />

        {/* Arlo response text */}
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
          {draftStatus === 'working' && <Cursor />}
        </div>

        {/* ApprovalCard when needs-approval */}
        {draftStatus === 'needs-approval' && (
          <ApprovalCard onApprove={onApprove} onDecline={onDecline} />
        )}

        {/* Approval result feedback */}
        {lastApprovalResult === 'approved' && (
          <div
            style={{
              fontSize: 12.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-success)',
              fontWeight: 500,
            }}
          >
            Change approved and applied.
          </div>
        )}
        {lastApprovalResult === 'declined' && (
          <div
            style={{
              fontSize: 12.5,
              fontFamily: 'var(--font-sans)',
              color: 'var(--color-danger)',
              fontWeight: 500,
            }}
          >
            Change declined.
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '10px 12px 12px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Draft status pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: draftStatus === 'needs-approval' ? 'var(--color-warning)' : 'var(--color-accent)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: 'var(--text-faint)',
            }}
          >
            Draft: {draftName}
          </span>
        </div>

        {/* Input row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            background: 'var(--surface-section)',
            borderRadius: 10,
            padding: '8px 8px 8px 12px',
            border: '1px solid var(--border)',
          }}
        >
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Arlo…"
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              resize: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              color: 'var(--text-body)',
              lineHeight: '20px',
              padding: 0,
            }}
          />
          <button
            onClick={() => {
              if (inputValue.trim() !== '') {
                setInputValue('')
                setTimeout(() => onNeedsApproval(), 1500)
              }
            }}
            disabled={inputValue.trim() === ''}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: inputValue.trim() !== '' ? 'var(--color-accent)' : 'var(--surface-sunken)',
              color: inputValue.trim() !== '' ? 'var(--text-on-accent)' : 'var(--text-faint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputValue.trim() !== '' ? 'pointer' : 'default',
              flexShrink: 0,
              padding: 0,
              transition: 'background 0.15s',
            }}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
