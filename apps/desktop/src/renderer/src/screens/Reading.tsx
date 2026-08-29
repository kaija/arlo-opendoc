import React from 'react';
import { TitleBar } from '../components/TitleBar';
import { Toolbar } from '../components/Toolbar';
import { Sidebar } from '../components/Sidebar';

function DocumentView(): React.ReactElement {
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
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          padding: '48px 40px',
        }}
      >
        {/* Frontmatter tags */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'owner', value: 'payments-team' },
            { label: 'review by', value: '2026-09-30' },
            { label: 'severity', value: 'sev1' },
          ].map(({ label, value }) => (
            <span
              key={label}
              style={{
                background: '#f0f0f8',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontFamily: 'var(--font-sans)',
                color: '#52526b',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: '#8e8eaa',
                  marginRight: 4,
                }}
              >
                {label}
              </span>
              {value}
            </span>
          ))}
        </div>

        {/* H1 */}
        <h1
          style={{
            fontSize: 31,
            fontWeight: 700,
            color: '#1a1a2e',
            letterSpacing: '-0.025em',
            marginBottom: 18,
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.2,
          }}
        >
          Payments service runbook
        </h1>

        {/* Intro paragraph */}
        <p
          style={{
            fontSize: 15,
            fontWeight: 400,
            lineHeight: 1.7,
            color: '#1a1a2e',
            maxWidth: '68ch',
            marginBottom: 32,
            fontFamily: 'var(--font-sans)',
          }}
        >
          This runbook covers the most common operational scenarios for the Payments service,
          including incident response procedures, escalation paths, and known failure modes.
          Reference this document during on-call shifts and postmortems.
        </p>

        {/* H2: Escalation path */}
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
          Escalation path
        </h2>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: '#1a1a2e',
            maxWidth: '68ch',
            marginBottom: 20,
            fontFamily: 'var(--font-sans)',
          }}
        >
          Follow the escalation chain below when a payments incident is confirmed. Response
          times are contractual SLAs; breach of response time should be escalated immediately
          to the next level.
        </p>

        {/* Table */}
        <div
          style={{
            border: '1px solid rgba(0,0,0,.08)',
            borderRadius: 8,
            overflow: 'hidden',
            maxWidth: 620,
            marginBottom: 36,
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'flex',
              background: '#f8f8fc',
              borderBottom: '1px solid rgba(0,0,0,.08)',
            }}
          >
            {[
              { label: 'Level', width: 88 },
              { label: 'Who', flex: 1 as const },
              { label: 'Response time', width: 130 },
            ].map(({ label, width, flex }) => (
              <div
                key={label}
                style={{
                  width: width,
                  flex: flex,
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: 'var(--font-sans)',
                  color: '#8e8eaa',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Table rows */}
          {[
            { level: 'L1', who: 'On-call engineer', time: '< 5 min' },
            { level: 'L2', who: 'Payments team lead', time: '< 15 min' },
            { level: 'L3', who: 'VP Engineering', time: '< 30 min' },
          ].map(({ level, who, time }, i) => (
            <div
              key={level}
              style={{
                display: 'flex',
                borderTop: i > 0 ? '1px solid rgba(0,0,0,.06)' : undefined,
              }}
            >
              <div
                style={{
                  width: 88,
                  padding: '9px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  color: '#52526b',
                }}
              >
                {level}
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  color: '#1a1a2e',
                }}
              >
                {who}
              </div>
              <div
                style={{
                  width: 130,
                  padding: '9px 12px',
                  fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  color: '#52526b',
                }}
              >
                {time}
              </div>
            </div>
          ))}
        </div>

        {/* H2: Failure modes */}
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
            marginBottom: 48,
            fontFamily: 'var(--font-sans)',
          }}
        >
          The following failure modes have been observed in production. Each entry includes
          root cause, detection signals, and recommended remediation steps. Refer to linked
          postmortems for historical context.
        </p>
      </div>
    </div>
  );
}

export function Reading(): React.ReactElement {
  const tabs = [
    { id: 't1', title: 'Payments service runbook', type: 'document' as const },
    { id: 't2', title: 'Deploy rollback', type: 'document' as const },
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
        draftStatus={null}
        draftName=""
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
        chatActive={false}
        onChatToggle={() => undefined}
        onPublish={() => undefined}
        onSearchClick={() => undefined}
        showDiffTab={false}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Sidebar variant="live" activeNoteId="payments" />
        <DocumentView />
      </div>
    </div>
  );
}
