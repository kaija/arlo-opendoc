import React from 'react';

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
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: '24px 28px',
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <p style={{ fontWeight: 600, fontSize: 15, margin: '0 0 8px', color: '#1a1a2e' }}>
          Close worktree?
        </p>
        <p style={{ fontSize: 12, color: '#8e8eaa', margin: '0 0 12px', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          {worktreePath}
        </p>
        <p style={{ fontSize: 13, color: '#444', margin: '0 0 20px' }}>
          All unsaved edits in this worktree will be permanently deleted.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,.12)',
              background: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#cf222e',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Delete worktree ⚠
          </button>
        </div>
      </div>
    </div>
  );
}
