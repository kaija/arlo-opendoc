import React from 'react';
import { Check } from 'lucide-react';

interface PublishModalProps {
  onPublish: () => void;
  onCancel: () => void;
}

interface FileChange {
  name: string;
  added: number;
  removed: number;
}

const FILES_CHANGED: FileChange[] = [
  { name: 'Payments service runbook', added: 18, removed: 2 },
  { name: 'ADR-014: Idempotency strategy', added: 4, removed: 0 },
  { name: 'API Reference — Payments', added: 6, removed: 1 },
  { name: 'INC-2291 postmortem', added: 3, removed: 0 },
];

const SUMMARY_POINTS = [
  'Added idempotency-key failure mode section with root cause and detection guidance',
  'Updated ADR-014 with enforcement policy reference from INC-2291',
  'Added Idempotency-Key header requirement to POST /charges API reference',
];

export function PublishModal({ onPublish, onCancel }: PublishModalProps): React.ReactElement {
  return (
    // Outer wrapper — covers the entire app surface
    <div
      style={{
        position: 'absolute',
        inset: 0,
      }}
    >
      {/* Backdrop — dimmed overlay; click anywhere outside the card to dismiss */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,26,46,.28)',
        }}
        onClick={() => onCancel()}
      />

      {/* Modal card — stop propagation so backdrop click does not fire through the card */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 620,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 24px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.10)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '18px 24px 0',
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: '#1a1a2e',
              fontFamily: 'var(--font-sans)',
              margin: 0,
            }}
          >
            Publish for review
          </h2>
        </div>

        {/* Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '14px 24px',
          }}
        >
          {/* Title field */}
          <FieldGroup label="Title">
            <div
              style={{
                height: 34,
                border: '1px solid rgba(0,0,0,.1)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                fontSize: 13,
                color: '#1a1a2e',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Add idempotency-key failure mode to payments runbook
            </div>
          </FieldGroup>

          {/* Summary field */}
          <FieldGroup
            label="Summary"
            rightLabel="Drafted by Arlo — edit freely"
          >
            <div
              style={{
                border: '1px solid rgba(0,0,0,.1)',
                borderRadius: 6,
                padding: '10px 12px',
              }}
            >
              {SUMMARY_POINTS.map((point, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: i < SUMMARY_POINTS.length - 1 ? 6 : 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: '#8e8eaa',
                      fontFamily: 'var(--font-sans)',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    •
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: '#1a1a2e',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1.55,
                    }}
                  >
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </FieldGroup>

          {/* Files changed */}
          <FieldGroup label={`${FILES_CHANGED.length} notes changed`}>
            <div
              style={{
                border: '1px solid rgba(0,0,0,.08)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {FILES_CHANGED.map((file, i) => (
                <div
                  key={file.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : undefined,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: '#1a1a2e',
                      fontFamily: 'var(--font-sans)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'var(--font-mono)',
                      color: '#1f9d6b',
                    }}
                  >
                    +{file.added}
                  </span>
                  {file.removed > 0 && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontFamily: 'var(--font-mono)',
                        color: '#d1435b',
                      }}
                    >
                      -{file.removed}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </FieldGroup>

          {/* Reviewers */}
          <FieldGroup label="Reviewers">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Reviewer tag */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 10px',
                  background: '#f0f0f8',
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#5856D6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 600,
                      color: '#fff',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    DO
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: '#1a1a2e',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Dana Okoye
                </span>
              </div>

              {/* Add reviewer pill */}
              <button
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: '1.5px dashed rgba(0,0,0,.12)',
                  background: 'transparent',
                  fontSize: 12,
                  color: '#8e8eaa',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                + Add
              </button>
            </div>
          </FieldGroup>

          {/* AI attribution checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: '#5856D6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <Check size={10} color="#fff" />
            </div>
            <span
              style={{
                fontSize: 12.5,
                color: '#52526b',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Note that Arlo helped write this
            </span>
          </div>
        </div>

        {/* Modal footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px 16px',
            borderTop: '1px solid rgba(0,0,0,.06)',
          }}
        >
          <button
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 12.5,
              color: '#64648c',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              fontWeight: 400,
            }}
            onClick={() => onCancel()}
          >
            Save and finish later
          </button>
          <button
            style={{
              height: 34,
              padding: '0 18px',
              borderRadius: 999,
              border: 'none',
              background: '#5856D6',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
            onClick={() => onPublish()}
          >
            Publish for review
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  rightLabel,
  children,
}: {
  label: string;
  rightLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: '#52526b',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </span>
        {rightLabel && (
          <span
            style={{
              fontSize: 11,
              color: '#8e8eaa',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {rightLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
