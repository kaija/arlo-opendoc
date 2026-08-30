import React from 'react';
import { useTranslation } from 'react-i18next';

export interface CloseWorktreeDialogProps {
  worktreePath: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CloseWorktreeDialog({
  worktreePath,
  onConfirm,
  onCancel,
}: CloseWorktreeDialogProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--surface-card)',
          borderRadius: 10,
          padding: '24px 28px',
          maxWidth: 420,
          width: '90%',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 8px', color: 'var(--text-body)' }}>
          {t('closeWorktree.title')}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 12px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          {worktreePath}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 20px' }}>
          {t('closeWorktree.body')}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-stronger)',
              background: 'var(--surface-card)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t('closeWorktree.cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-danger-text)',
              color: 'var(--text-on-accent)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t('closeWorktree.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
