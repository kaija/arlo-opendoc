import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const modes = useMemo(
    () =>
      showDiffTab
        ? [
            { id: 'preview' as const, label: t('toolbar.preview') },
            { id: 'edit'    as const, label: t('toolbar.edit')    },
            { id: 'diff'    as const, label: t('toolbar.whatChanged') },
          ]
        : [
            { id: 'preview' as const, label: t('toolbar.preview') },
            { id: 'edit'    as const, label: t('toolbar.edit')    },
          ],
    [showDiffTab, t],
  );
  return (
    <div
      style={{
        height: 48,
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--border-mid)',
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
                    color: 'var(--text-disabled)',
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
                  color: isLast ? 'var(--text-body)' : 'var(--text-faint)',
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
          background: 'var(--surface-sunken)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Search size={13} color="var(--text-faint)" style={{ flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: 12.5,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'left',
          }}
        >
          {t('toolbar.searchPlaceholder')}
        </span>
        <span
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '3px 5px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-faint)',
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
          background: 'var(--surface-sunken)',
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
                color: isActive ? 'var(--text-on-accent)' : 'var(--text-muted)',
                background: isActive ? 'var(--color-accent)' : 'transparent',
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
          border: '1px solid var(--border-strong)',
          background: 'var(--surface-card)',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: publishEnabled ? 'var(--text-body)' : 'var(--text-disabled)',
          cursor: publishEnabled ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {t('toolbar.publish')}
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
            border: '1px solid var(--color-accent-a35)',
            background: isSaving ? 'var(--surface-sunken)' : 'var(--color-accent-a08)',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
            color: isSaving ? 'var(--text-faint)' : 'var(--color-accent)',
            cursor: isSaving ? 'default' : 'pointer',
            flexShrink: 0,
            transition: 'opacity 0.1s',
          }}
        >
          {isSaving ? t('toolbar.saving') : t('toolbar.save')}
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
          background: chatActive ? 'var(--color-accent-a08)' : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <MessageSquare size={15} color={chatActive ? 'var(--color-accent)' : 'var(--text-muted)'} />
      </button>
    </div>
  );
}
