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
        background: '#5856D6',
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
    add: '#eefaf4',
    remove: '#fdf0f2',
    context: 'transparent',
  }
  const markerMap = {
    add: '+',
    remove: '-',
    context: ' ',
  }
  const markerBgMap = {
    add: '#d6f2e4',
    remove: '#f7d7dd',
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
            line.type === 'add' ? '#1f9d6b' : line.type === 'remove' ? '#d1435b' : '#8e8eaa',
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
          Arlo drafted this change. Review the diff before approving — you can always edit after.
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={onDecline}
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
            onClick={onApprove}
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
        background: '#fff',
        borderLeft: '1px solid rgba(0,0,0,.08)',
        borderRadius: '12px 0 0 12px',
        boxShadow: '-10px 0 24px rgba(0,0,0,.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid rgba(0,0,0,.06)',
          flexShrink: 0,
        }}
      >
        {/* Title */}
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            color: '#1a1a2e',
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
                background: 'rgba(88,86,214,.06)',
                borderRadius: 20,
                padding: '3px 10px',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#5856D6',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: '#5856D6',
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
                background: 'rgba(192,122,18,.08)',
                borderRadius: 20,
                padding: '3px 10px',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#c07a12',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: '#c07a12',
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
            color: '#8e8eaa',
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
            color: '#1a1a2e',
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
              color: '#1f9d6b',
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
              color: '#d1435b',
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
          borderTop: '1px solid rgba(0,0,0,.06)',
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
              background: draftStatus === 'needs-approval' ? '#c07a12' : '#5856D6',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: '#8e8eaa',
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
            background: '#f8f8fc',
            borderRadius: 10,
            padding: '8px 8px 8px 12px',
            border: '1px solid rgba(0,0,0,.06)',
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
              color: '#1a1a2e',
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
              background: inputValue.trim() !== '' ? '#5856D6' : '#f0f0f8',
              color: inputValue.trim() !== '' ? '#fff' : '#8e8eaa',
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
