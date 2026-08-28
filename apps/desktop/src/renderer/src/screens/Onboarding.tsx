import React from 'react';
import { FileText, Globe } from 'lucide-react';

// Electron-specific CSS property not in React's type definitions
type ElectronCSSProperties = React.CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

interface OnboardingProps {
  onChooseLocal: () => void;
  onChooseGitHub: () => void;
  isPending?: boolean;
  error?: string | null;
}

export function Onboarding({ onChooseLocal, onChooseGitHub, isPending, error }: OnboardingProps): React.ReactElement {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8f8fc',
      }}
    >
      {/* Top bar: traffic lights only */}
      <div
        style={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 20,
          gap: 8,
          flexShrink: 0,
          WebkitAppRegion: 'drag',
        } as ElectronCSSProperties}
      >
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#ff5f57',
            display: 'block',
          }}
        />
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#febc2e',
            display: 'block',
          }}
        />
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: '#28c840',
            display: 'block',
          }}
        />
      </div>

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
              background: '#5856D6',
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
                color: '#fff',
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
              color: '#1a1a2e',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.02em',
            }}
          >
            Arlo
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 27,
            fontWeight: 700,
            color: '#1a1a2e',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '-0.025em',
            textAlign: 'center',
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          Where should your knowledge live?
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: '#64648c',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 1.55,
            maxWidth: 380,
          }}
        >
          Pick one to start. Arlo works the same way in both.
        </p>

        {/* Cards */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 28,
          }}
        >
          <OnboardingCard
            icon={<FileText size={22} color="#5856D6" />}
            title="Personal knowledge base"
            description="Keep your notes and documents in a local folder. Everything stays on your machine, searchable instantly."
            buttonLabel={isPending ? 'Opening…' : 'Choose folder…'}
            buttonDisabled={isPending === true}
            onClick={onChooseLocal}
          />
          <OnboardingCard
            icon={<Globe size={22} color="#5856D6" />}
            title="Team knowledge base"
            description="Connect to a GitHub repository so your whole team shares and contributes to a single source of truth."
            buttonLabel="Continue with GitHub"
            onClick={onChooseGitHub}
          />
        </div>

        {error && (
          <p
            style={{
              fontSize: 12.5,
              color: '#c0392b',
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
            color: '#8e8eaa',
            fontFamily: 'var(--font-sans)',
            textAlign: 'center',
          }}
        >
          You can add more knowledge bases later.
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
        background: '#fff',
        border: '1px solid rgba(0,0,0,.08)',
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
          background: 'rgba(88,86,214,.08)',
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
          color: '#1a1a2e',
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
          color: '#64648c',
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
          border: '1px solid rgba(0,0,0,.12)',
          background: '#fff',
          fontSize: 12.5,
          fontWeight: 500,
          fontFamily: 'var(--font-sans)',
          color: '#1a1a2e',
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
