import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Globe, FolderOpen } from 'lucide-react';
import type { RecentRepoSummary } from '@arlo-doc/client';

// Electron-specific CSS property not in React's type definitions
type ElectronCSSProperties = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

interface OnboardingProps {
  onChooseLocal: () => void;
  onChooseGitHub: () => void;
  /** Recently opened repositories, newest first. */
  recentRepos?: RecentRepoSummary[];
  onOpenRepo?: (path: string) => void;
  isPending?: boolean;
  error?: string | null;
}

export function Onboarding({
  onChooseLocal,
  onChooseGitHub,
  recentRepos,
  onOpenRepo,
  isPending,
  error,
}: OnboardingProps): React.ReactElement {
  const { t } = useTranslation();
  const recent = recentRepos ?? [];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-section)',
      }}
    >
      {/* Top bar: spacer for native traffic-light buttons (hiddenInset) */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'drag',
        } as ElectronCSSProperties}
      />

      {/* Centered content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          gap: 0,
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-on-accent)',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1,
              }}
            >
              A
            </span>
          </div>
          <span
            style={{
              fontSize: 21,
              fontWeight: 700,
              color: 'var(--text-body)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('onboarding.brand')}
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 27,
            fontWeight: 700,
            color: 'var(--text-body)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.025em',
            textAlign: 'center',
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          {t('onboarding.headline')}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 1.55,
            maxWidth: 380,
          }}
        >
          {t('onboarding.subtitle')}
        </p>

        {/* Cards */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: recent.length > 0 ? 20 : 28,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <OnboardingCard
            icon={<FileText size={22} color="var(--color-accent)" />}
            title={t('onboarding.personalTitle')}
            description={t('onboarding.personalDescription')}
            buttonLabel={isPending ? t('onboarding.opening') : t('onboarding.chooseFolder')}
            buttonDisabled={isPending === true}
            onClick={onChooseLocal}
          />
          <OnboardingCard
            icon={<Globe size={22} color="var(--color-accent)" />}
            title={t('onboarding.teamTitle')}
            description={t('onboarding.teamDescription')}
            buttonLabel={t('onboarding.continueWithGitHub')}
            onClick={onChooseGitHub}
          />
        </div>

        {/* Recent repositories — the fast path back into a knowledge base */}
        {recent.length > 0 && onOpenRepo && (
          <div style={{ width: '100%', maxWidth: 480, marginBottom: 28 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                fontFamily: 'var(--font-sans)',
                margin: '0 0 8px 2px',
              }}
            >
              {t('onboarding.recentTitle')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map((repo) => (
                <button
                  key={repo.path}
                  onClick={() => onOpenRepo(repo.path)}
                  disabled={isPending}
                  title={repo.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    height: 44,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-mid)',
                    background: 'var(--surface-card)',
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    opacity: isPending ? 0.6 : 1,
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  <FolderOpen size={15} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--text-body)',
                      fontFamily: 'var(--font-sans)',
                      flexShrink: 0,
                    }}
                  >
                    {repo.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--text-faint)',
                      fontFamily: 'var(--font-sans)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      direction: 'rtl', // keep the meaningful tail of the path visible
                    }}
                  >
                    {repo.path}
                  </span>
                  {repo.worktreeCount > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                        flexShrink: 0,
                      }}
                    >
                      {repo.worktreeCount === 1
                        ? t('onboarding.recentDraftsOne')
                        : t('onboarding.recentDraftsMany', { count: repo.worktreeCount })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--color-error-text)',
              fontFamily: 'var(--font-sans)',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            {error}
          </p>
        )}

        {/* Footer note */}
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
          }}
        >
          {t('onboarding.footerNote')}
        </p>
      </div>
    </div>
  );
}

function OnboardingCard({
  icon,
  title,
  description,
  buttonLabel,
  buttonDisabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  buttonDisabled?: boolean;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <div
      style={{
        width: 300,
        background: 'var(--surface-card)',
        border: '1px solid var(--border-mid)',
        borderRadius: 16,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
      }}
    >
      {/* Icon square */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'var(--color-accent-a08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-body)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 400,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.6,
          flex: 1,
        }}
      >
        {description}
      </p>

      {/* CTA button */}
      <button
        onClick={onClick}
        disabled={buttonDisabled}
        style={{
          height: 36,
          padding: '0 16px',
          borderRadius: 999,
          border: '1px solid var(--border-stronger)',
          background: 'var(--surface-card)',
          fontSize: 12.5,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: 'var(--text-body)',
          cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          opacity: buttonDisabled ? 0.6 : 1,
          textAlign: 'center',
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
