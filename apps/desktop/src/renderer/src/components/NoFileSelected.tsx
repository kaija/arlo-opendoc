import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';

export function NoFileSelected(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: 'var(--surface-card)',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'var(--surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FileText size={22} color="var(--text-dim)" />
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
          margin: 0,
          fontWeight: 400,
        }}
      >
        {t('noFileSelected.message')}
      </p>
    </div>
  );
}
