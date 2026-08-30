import React from 'react';
import type { AppSettings, KbSettings, SecretStatus } from '@arlo-doc/shared';
import type { AppInfo, SettingsPatch } from '@arlo-doc/client';

/**
 * Owns everything the settings dialog reads and writes.
 *
 * Writes are optimistic: the control moves immediately and the IPC round-trip
 * happens behind it. That is what makes instant-apply feel instant. If the main
 * process rejects a write, the authoritative value it returns replaces the
 * optimistic one, so the UI cannot drift from what is actually stored.
 */

export interface SettingsState {
  app: AppSettings | null;
  kb: KbSettings | null;
  secrets: SecretStatus | null;
  appInfo: AppInfo | null;
  gitIdentity: { name: string; email: string } | null;
  instructions: string;
  loading: boolean;
  error: string | null;
}

export interface SettingsApi extends SettingsState {
  /** Absolute path of the open knowledge base, or null when none is open. */
  repoPath: string | null;
  patchApp: (patch: SettingsPatch<AppSettings>) => void;
  patchKb: (patch: SettingsPatch<KbSettings>) => void;
  saveInstructions: (content: string) => Promise<void>;
  refreshSecrets: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useSettings(
  repoPath: string | null,
  open: boolean,
  /**
   * Called whenever the application settings this hook holds change — on the
   * initial load and after every application-scope write — so the app shell can
   * react while the dialog is still open. Switching theme should repaint
   * immediately, not on close.
   */
  onAppSettingsChange?: (next: AppSettings) => void,
): SettingsApi {
  const [state, setState] = React.useState<SettingsState>({
    app: null,
    kb: null,
    secrets: null,
    appInfo: null,
    gitIdentity: null,
    instructions: '',
    loading: true,
    error: null,
  });

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const [appRes, secretsRes, infoRes] = await Promise.all([
      window.arlodoc.readAppSettings(),
      window.arlodoc.getSecretStatus(),
      window.arlodoc.getAppInfo(),
    ]);

    // Knowledge-base data only exists when a folder is open. Asking for it with
    // no repo would be meaningless, so the KB panes render disabled instead.
    const [kbRes, identityRes, instructionsRes] =
      repoPath !== null
        ? await Promise.all([
            window.arlodoc.readKbSettings(repoPath),
            window.arlodoc.getGitIdentity(repoPath),
            window.arlodoc.readInstructions(repoPath),
          ])
        : [null, null, null];

    setState({
      app: appRes.ok ? appRes.data : null,
      kb: kbRes?.ok === true ? kbRes.data : null,
      secrets: secretsRes.ok ? secretsRes.data : null,
      appInfo: infoRes.ok ? infoRes.data : null,
      gitIdentity: identityRes?.ok === true ? identityRes.data : null,
      instructions: instructionsRes?.ok === true ? instructionsRes.data : '',
      loading: false,
      error: appRes.ok ? null : appRes.error.message,
    });
  }, [repoPath]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const patchApp = React.useCallback((patch: SettingsPatch<AppSettings>) => {
    // Move the control now; reconcile with what was actually stored after.
    // This updater must stay PURE — React runs it during the render phase, so
    // notifying the app shell from in here would be a setState on another
    // component mid-render. The effect below does that instead.
    setState((s) => (s.app === null ? s : { ...s, app: mergeApp(s.app, patch) }));
    void window.arlodoc.writeAppSettings(patch).then((res) => {
      if (res.ok) setState((s) => ({ ...s, app: res.data }));
      else setState((s) => ({ ...s, error: res.error.message }));
    });
  }, []);

  // The app shell is told about application settings HERE rather than at each
  // write site: once state has committed, so it is never a setState during
  // another component's render, and once per distinct value, so the initial
  // load, the optimistic update and the stored result all flow through the
  // same path.
  React.useEffect(() => {
    if (state.app !== null) onAppSettingsChange?.(state.app);
  }, [state.app, onAppSettingsChange]);

  const patchKb = React.useCallback(
    (patch: SettingsPatch<KbSettings>) => {
      if (repoPath === null) return;
      setState((s) => (s.kb === null ? s : { ...s, kb: mergeKb(s.kb, patch) }));
      void window.arlodoc.writeKbSettings(repoPath, patch).then((res) => {
        if (res.ok) setState((s) => ({ ...s, kb: res.data }));
        else setState((s) => ({ ...s, error: res.error.message }));
      });
    },
    [repoPath],
  );

  const saveInstructions = React.useCallback(
    async (content: string) => {
      if (repoPath === null) return;
      setState((s) => ({ ...s, instructions: content }));
      const res = await window.arlodoc.writeInstructions(repoPath, content);
      if (!res.ok) setState((s) => ({ ...s, error: res.error.message }));
    },
    [repoPath],
  );

  const refreshSecrets = React.useCallback(async () => {
    const res = await window.arlodoc.getSecretStatus();
    if (res.ok) setState((s) => ({ ...s, secrets: res.data }));
  }, []);

  return { ...state, repoPath, patchApp, patchKb, saveInstructions, refreshSecrets, reload: load };
}

// ── Optimistic merge ───────────────────────────────────────────────────────
// Mirrors the one-level-deep merge the main process performs, so the optimistic
// value and the stored value agree.

function mergeApp(current: AppSettings, patch: SettingsPatch<AppSettings>): AppSettings {
  return {
    general: { ...current.general, ...(patch.general ?? {}) },
    appearance: { ...current.appearance, ...(patch.appearance ?? {}) },
    editor: { ...current.editor, ...(patch.editor ?? {}) },
    agent: { ...current.agent, ...(patch.agent ?? {}) },
  };
}

function mergeKb(current: KbSettings, patch: SettingsPatch<KbSettings>): KbSettings {
  return {
    repository: { ...current.repository, ...(patch.repository ?? {}) },
    publishing: { ...current.publishing, ...(patch.publishing ?? {}) },
    search: { ...current.search, ...(patch.search ?? {}) },
    agent: { ...current.agent, ...(patch.agent ?? {}) },
  };
}
