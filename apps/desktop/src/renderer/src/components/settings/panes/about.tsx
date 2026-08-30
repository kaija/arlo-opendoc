import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ExternalLink } from 'lucide-react';
import type { PaneDef } from '../paneTypes';
import type { SettingsApi } from '../useSettings';
import { Button, Field, StatusLine } from '../fields';

/**
 * Every destructive action here states its exact blast radius, and resetting
 * preferences is deliberately separate from forgetting credentials — signing
 * someone out of GitHub as a side effect of restoring their fonts would be a
 * bad surprise.
 */

function ConfirmButton({
  label,
  confirmLabel,
  detail,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  detail: React.ReactNode;
  onConfirm: () => void | Promise<void>;
}): React.ReactElement {
  const { t } = useTranslation();
  const [armed, setArmed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {armed ? (
          <>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => {
                setBusy(true);
                void Promise.resolve(onConfirm()).finally(() => {
                  setBusy(false);
                  setArmed(false);
                });
              }}
            >
              {confirmLabel}
            </Button>
            <Button onClick={() => setArmed(false)}>{t('settings.about.reset.cancel')}</Button>
          </>
        ) : (
          <Button variant="danger" onClick={() => setArmed(true)}>
            {label}
          </Button>
        )}
      </div>
      <p
        style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-sans)',
          margin: 0,
        }}
      >
        {detail}
      </p>
    </div>
  );
}

function AboutHeader({ s }: { s: SettingsApi }): React.ReactElement {
  const { t } = useTranslation();
  const info = s.appInfo;
  return (
    <div style={{ marginBottom: 28 }}>
      <p
        style={{
          fontSize: 13,
          color: 'var(--text-body)',
          fontFamily: 'var(--font-sans)',
          margin: 0,
          marginBottom: 6,
        }}
      >
        {t('settings.about.versionLine', { version: info?.version ?? '—' })}
        <span style={{ color: 'var(--text-faint)' }}>
          {' · '}Electron {info?.electronVersion ?? '—'}
          {' · '}
          {info?.platform ?? '—'} {info?.osVersion ?? ''}
        </span>
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', margin: 0 }}>
        MIT ·{' '}
        {[
          ['arlo-ai.app', 'https://arlo-ai.app'],
          [t('settings.about.linkSource'), 'https://github.com/kaija/arlo-opendoc'],
          [t('settings.about.linkReportIssue'), 'https://github.com/kaija/arlo-opendoc/issues'],
        ].map(([label, url], i) => (
          <React.Fragment key={url}>
            {i > 0 && ' · '}
            <button
              type="button"
              onClick={() => void window.arlodoc.openExternal(url!)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                color: 'var(--color-accent)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {label} <ExternalLink size={10} />
            </button>
          </React.Fragment>
        ))}
      </p>
      {s.appInfo?.encryptionAvailable === false && (
        <div style={{ marginTop: 12 }}>
          <StatusLine tone="warning">{t('settings.about.encryptionUnavailable')}</StatusLine>
        </div>
      )}
    </div>
  );
}

export function buildAboutPane(t: TFunction): PaneDef {
  return {
    id: 'about',
    label: t('settings.about.label'),
    scope: 'about',
    custom: (s) => <AboutHeader s={s} />,
    sections: [
      {
        title: t('settings.about.sections.files'),
        entries: [
          {
            id: 'files',
            label: t('settings.about.files.entryLabel'),
            keywords: ['reveal', 'finder', 'explorer', 'logs', 'json', 'debug'],
            render: (s) => (
              <Field label={t('settings.about.files.fieldLabel')} hint={s.appInfo?.userDataPath ?? ''}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Button onClick={() => void window.arlodoc.revealSettingsFile()}>
                    {t('settings.about.files.revealSettings')}
                  </Button>
                  <Button onClick={() => void window.arlodoc.openLogsFolder()}>
                    {t('settings.about.files.openLogs')}
                  </Button>
                </div>
              </Field>
            ),
          },
        ],
      },
      {
        title: t('settings.about.sections.reset'),
        entries: [
          {
            id: 'reset-preferences',
            label: t('settings.about.reset.resetPreferencesEntry'),
            keywords: ['default', 'restore', 'clear', 'wipe'],
            render: (s) => (
              <ConfirmButton
                label={t('settings.about.reset.resetPreferencesButton')}
                confirmLabel={t('settings.about.reset.resetPreferencesConfirm')}
                detail={t('settings.about.reset.resetPreferencesDetail')}
                onConfirm={async () => {
                  await window.arlodoc.resetPreferences();
                  await s.reload();
                }}
              />
            ),
          },
          {
            id: 'forget-credentials',
            label: t('settings.about.reset.forgetEntry'),
            keywords: ['sign out', 'logout', 'api key', 'token', 'keychain', 'disconnect'],
            render: (s) => (
              <ConfirmButton
                label={t('settings.about.reset.forgetButton')}
                confirmLabel={t('settings.about.reset.forgetConfirm')}
                detail={t('settings.about.reset.forgetDetail')}
                onConfirm={async () => {
                  await window.arlodoc.forgetCredentials();
                  await s.refreshSecrets();
                }}
              />
            ),
          },
        ],
      },
    ],
  };
}
