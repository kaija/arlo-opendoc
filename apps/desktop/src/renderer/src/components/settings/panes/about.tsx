import React from 'react';
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
            <Button onClick={() => setArmed(false)}>Cancel</Button>
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
        Arlo Doc {info?.version ?? '—'}
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
          ['Source', 'https://github.com/kaija/arlo-opendoc'],
          ['Report an issue', 'https://github.com/kaija/arlo-opendoc/issues'],
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
          <StatusLine tone="warning">
            This system offers no encrypted storage, so credentials cannot be saved.
          </StatusLine>
        </div>
      )}
    </div>
  );
}

export const aboutPane: PaneDef = {
  id: 'about',
  label: 'About',
  scope: 'about',
  custom: (s) => <AboutHeader s={s} />,
  sections: [
    {
      title: 'Files',
      entries: [
        {
          id: 'files',
          label: 'Settings file and logs',
          keywords: ['reveal', 'finder', 'explorer', 'logs', 'json', 'debug'],
          render: (s) => (
            <Field
              label="On this machine"
              hint={s.appInfo?.userDataPath ?? ''}
            >
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button onClick={() => void window.arlodoc.revealSettingsFile()}>
                  Reveal settings file
                </Button>
                <Button onClick={() => void window.arlodoc.openLogsFolder()}>Open logs</Button>
              </div>
            </Field>
          ),
        },
      ],
    },
    {
      title: 'Reset',
      entries: [
        {
          id: 'reset-preferences',
          label: 'Reset preferences',
          keywords: ['default', 'restore', 'clear', 'wipe'],
          render: (s) => (
            <ConfirmButton
              label="Reset preferences…"
              confirmLabel="Reset preferences"
              detail="Restores every default, for this and every knowledge base. Keeps your credentials, your repositories and your documents."
              onConfirm={async () => {
                await window.arlodoc.resetPreferences();
                await s.reload();
              }}
            />
          ),
        },
        {
          id: 'forget-credentials',
          label: 'Sign out and forget credentials',
          keywords: ['sign out', 'logout', 'api key', 'token', 'keychain', 'disconnect'],
          render: (s) => (
            <ConfirmButton
              label="Sign out and forget credentials…"
              confirmLabel="Forget credentials"
              detail="Removes the Anthropic API key and the GitHub token from your keychain. Nothing on disk is deleted and no repository is touched."
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
