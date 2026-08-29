import React, { useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';

interface ToolbarProps {
  breadcrumb: string[];
  activeMode: 'preview' | 'edit' | 'diff';
  onModeChange: (mode: 'preview' | 'edit' | 'diff') => void;
  publishEnabled: boolean;
  chatActive: boolean;
  onChatToggle: () => void;
  onPublish: () => void;
  onSearchClick: () => void;
  showDiffTab: boolean;
  hasUnsavedChanges?: boolean | undefined;
  onSave?: (() => void) | undefined;
  isSaving?: boolean | undefined;
}

export function Toolbar({
  breadcrumb,
  activeMode,
  onModeChange,
  publishEnabled,
  chatActive,
  onChatToggle,
  onPublish,
  onSearchClick,
  showDiffTab,
  hasUnsavedChanges = false,
  onSave,
  isSaving = false,
}: ToolbarProps): React.ReactElement {
  const modes = useMemo(
    () =>
      showDiffTab
        ? [
            { id: 'preview' as const, label: 'Preview' },
            { id: 'edit'    as const, label: 'Edit'    },
            { id: 'diff'    as const, label: 'What changed' },
          ]
        : [
            { id: 'preview' as const, label: 'Preview' },
            { id: 'edit'    as const, label: 'Edit'    },
          ],
    [showDiffTab],
  );
  return (
    <div
      style={{
        height: 48,
        background: '#fff',
        borderBottom: '1px solid rgba(0,0,0,.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12.5,
          fontFamily: 'var(--font-sans)',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {breadcrumb.map((segment, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <span
                  style={{
                    color: '#c9c9d6',
                    flexShrink: 0,
                    paddingLeft: 2,
                    paddingRight: 2,
                  }}
                >
                  /
                </span>
              )}
              <span
                style={{
                  fontWeight: isLast ? 500 : 400,
                  color: isLast ? '#1a1a2e' : '#8e8eaa',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: isLast ? 'ellipsis' : undefined,
                  minWidth: 0,
                }}
              >
                {segment}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Search bar */}
      <button
        onClick={onSearchClick}
        style={{
          width: 420,
          height: 28,
          borderRadius: 6,
          background: '#f0f0f8',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Search size={13} color="#8e8eaa" style={{ flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: 12.5,
            color: '#8e8eaa',
            fontFamily: 'var(--font-sans)',
            textAlign: 'left',
          }}
        >
          Search Platform Handbook
        </span>
        <span
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,.06)',
            borderRadius: 4,
            padding: '3px 5px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#8e8eaa',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ⌘K
        </span>
      </button>

      {/* Mode segmented control */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          gap: 2,
          borderRadius: 6,
          background: '#f0f0f8',
          flexShrink: 0,
        }}
      >
        {modes.map(({ id, label }) => {
          const isActive = activeMode === id;
          return (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              style={{
                height: 24,
                padding: '0 8px',
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 500 : 400,
                fontFamily: 'var(--font-sans)',
                color: isActive ? '#fff' : '#64648c',
                background: isActive ? '#5856D6' : 'transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Publish button */}
      <button
        onClick={onPublish}
        disabled={!publishEnabled}
        style={{
          height: 28,
          padding: '0 12px',
          borderRadius: 6,
          border: '1px solid rgba(0,0,0,.1)',
          background: '#fff',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: publishEnabled ? '#1a1a2e' : '#c9c9d6',
          cursor: publishEnabled ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        Publish
      </button>

      {/* Save button — visible only when there are unsaved changes */}
      {hasUnsavedChanges && (
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            height: 28,
            padding: '0 12px',
            borderRadius: 6,
            border: '1px solid rgba(88,86,214,.35)',
            background: isSaving ? '#f0f0f8' : 'rgba(88,86,214,.08)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            color: isSaving ? '#8e8eaa' : '#5856D6',
            cursor: isSaving ? 'default' : 'pointer',
            flexShrink: 0,
            transition: 'opacity 0.1s',
          }}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      )}

      {/* Chat toggle */}
      <button
        onClick={onChatToggle}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: chatActive ? 'rgba(88,86,214,.08)' : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <MessageSquare size={15} color={chatActive ? '#5856D6' : '#64648c'} />
      </button>
    </div>
  );
}
