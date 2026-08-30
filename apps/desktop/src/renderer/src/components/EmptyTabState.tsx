import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';

interface EmptyTabStateProps {
  onOpenFolder: () => void;
  lastFolderPath?: string | null | undefined;
  onResume?: () => void;
}

export function EmptyTabState({
  onOpenFolder,
  lastFolderPath,
  onResume,
}: EmptyTabStateProps): React.ReactElement {
  const { t } = useTranslation();
  const lastFolderName = lastFolderPath
    ? lastFolderPath.split('/').filter(Boolean).pop() ?? lastFolderPath
    : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0, fontFamily: 'var(--font-sans)' }}>
        {t('emptyTab.noFolder')}
      </p>

      {/* Quick-resume banner */}
      {lastFolderName && onResume && (
        <button
          onClick={onResume}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 44,
            padding: '0 18px',
            borderRadius: 10,
            border: '1px solid var(--color-accent-a25)',
            background: 'var(--color-accent-a05)',
            cursor: 'pointer',
            maxWidth: 360,
            width: '100%',
          }}
        >
          <FolderOpen size={16} color="var(--color-accent)" style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-accent)',
            fontFamily: 'var(--font-sans)',
            flex: 1,
            textAlign: 'left',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <Trans i18nKey="emptyTab.continueWith" values={{ name: lastFolderName }} components={{ strong: <strong /> }} />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
            {t('emptyTab.lastOpened')}
          </span>
        </button>
      )}

      <button
        onClick={onOpenFolder}
        style={{
          padding: '8px 20px',
          borderRadius: 8,
          border: '1.5px dashed var(--color-accent-a40)',
          background: 'transparent',
          color: 'var(--color-accent)',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        {t('emptyTab.openFolder')}
      </button>
    </div>
  );
}
