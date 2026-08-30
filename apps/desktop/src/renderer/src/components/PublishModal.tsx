import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { KbSettings } from '@arlo-doc/shared';

interface PublishModalProps {
  onPublish: () => void;
  onCancel: () => void;
  /** Repository whose publishing settings shape this pull request. */
  repoDir?: string | null | undefined;
}

interface FileChange {
  name: string;
  added: number;
  removed: number;
}

const FILES_CHANGED: FileChange[] = [
  { name: 'Payments service runbook', added: 18, removed: 2 },
  { name: 'ADR-014: Idempotency strategy', added: 4, removed: 0 },
  { name: 'API Reference — Payments', added: 6, removed: 1 },
  { name: 'INC-2291 postmortem', added: 3, removed: 0 },
];

const SUMMARY_POINTS = [
  'Added idempotency-key failure mode section with root cause and detection guidance',
  'Updated ADR-014 with enforcement policy reference from INC-2291',
  'Added Idempotency-Key header requirement to POST /charges API reference',
];

/**
 * Fills the description template from Settings > Publishing.
 *
 * The placeholders are the two the settings pane documents. Substitution is a
 * plain replace rather than a template engine: the template is user-authored
 * markdown, and anything cleverer would start interpreting their prose.
 */
function renderTemplate(
  template: string,
  summary: string[],
  files: FileChange[],
): string {
  return template
    .replace(/\{\{summary\}\}/g, summary.map((p) => `- ${p}`).join('\n'))
    .replace(
      /\{\{files\}\}/g,
      files.map((f) => `- ${f.name} (+${f.added} −${f.removed})`).join('\n'),
    );
}

export function PublishModal({
  onPublish,
  onCancel,
  repoDir,
}: PublishModalProps): React.ReactElement {
  const { t } = useTranslation();
  const [publishing, setPublishing] = React.useState<KbSettings['publishing'] | null>(null);
  const [defaultBranch, setDefaultBranch] = React.useState('main');

  React.useEffect(() => {
    if (repoDir == null || repoDir === '') return;
    let cancelled = false;
    void window.arlodoc.readKbSettings(repoDir).then((res) => {
      if (cancelled || !res.ok) return;
      setPublishing(res.data.publishing);
      setDefaultBranch(res.data.repository.defaultBranch);
    });
    return () => {
      cancelled = true;
    };
  }, [repoDir]);

  // Empty means "use the default branch", exactly as the setting's hint says.
  const target =
    publishing !== null && publishing.mergeInto.trim() !== ''
      ? publishing.mergeInto
      : defaultBranch;
  const description =
    publishing === null
      ? ''
      : renderTemplate(publishing.prTemplate, SUMMARY_POINTS, FILES_CHANGED);

  return (
    // Outer wrapper — covers the entire app surface
    <div
      style={{
        position: 'absolute',
        inset: 0,
      }}
    >
      {/* Backdrop — dimmed overlay; click anywhere outside the card to dismiss */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--color-scrim)',
        }}
        onClick={() => onCancel()}
      />

      {/* Modal card — stop propagation so backdrop click does not fire through the card */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 620,
          background: 'var(--surface-card)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-overlay)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '18px 24px 0',
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-body)',
              fontFamily: 'var(--font-sans)',
              margin: 0,
            }}
          >
            {t('publish.title')}
          </h2>
        </div>

        {/* Body */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: '14px 24px',
          }}
        >
          {/* Title field */}
          <FieldGroup label={t('publish.fieldTitle')}>
            <div
              style={{
                height: 34,
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                fontSize: 13,
                color: 'var(--text-body)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {t('publish.titleSample')}
            </div>
          </FieldGroup>

          {/* Summary field */}
          <FieldGroup
            label={t('publish.fieldSummary')}
            rightLabel={
              publishing?.agentDraftsPr === false
                ? t('publish.summaryWriteYourOwn')
                : t('publish.summaryDraftedByArlo')
            }
          >
            <div
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                padding: '10px 12px',
              }}
            >
              {SUMMARY_POINTS.map((point, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginBottom: i < SUMMARY_POINTS.length - 1 ? 6 : 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-faint)',
                      fontFamily: 'var(--font-sans)',
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    •
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-body)',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1.55,
                    }}
                  >
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </FieldGroup>

          {/* Description — the template from Settings > Publishing, filled in.
              Shown so the shape of the pull request is visible before it is
              created, not discovered afterwards on GitHub. */}
          {description !== '' && (
            <FieldGroup label={t('publish.fieldDescription')} rightLabel={t('publish.mergingInto', { target })}>
              <pre
                style={{
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  color: 'var(--text-muted-strong)',
                  background: 'var(--surface-section)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 140,
                  overflowY: 'auto',
                }}
              >
                {description}
              </pre>
              {publishing?.openAsDraft === true && (
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-faint)',
                    fontFamily: 'var(--font-sans)',
                    margin: '8px 0 0',
                  }}
                >
                  {t('publish.opensAsDraft')}
                </p>
              )}
            </FieldGroup>
          )}

          {/* Files changed */}
          <FieldGroup label={t('publish.notesChanged', { count: FILES_CHANGED.length })}>
            <div
              style={{
                border: '1px solid var(--border-mid)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              {FILES_CHANGED.map((file, i) => (
                <div
                  key={file.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      color: 'var(--text-body)',
                      fontFamily: 'var(--font-sans)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--color-success)',
                    }}
                  >
                    +{file.added}
                  </span>
                  {file.removed > 0 && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-danger)',
                      }}
                    >
                      -{file.removed}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </FieldGroup>

          {/* Reviewers */}
          <FieldGroup label={t('publish.fieldReviewers')}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Reviewer tag */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 10px',
                  background: 'var(--surface-sunken)',
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 600,
                      color: 'var(--text-on-accent)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    DO
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-body)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Dana Okoye
                </span>
              </div>

              {/* Add reviewer pill */}
              <button
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 999,
                  border: '1.5px dashed var(--border-stronger)',
                  background: 'transparent',
                  fontSize: 12,
                  color: 'var(--text-faint)',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {t('publish.addReviewer')}
              </button>
            </div>
          </FieldGroup>

          {/* AI attribution checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <Check size={10} style={{ color: 'var(--text-on-accent)' }} />
            </div>
            <span
              style={{
                fontSize: 12.5,
                color: 'var(--text-muted-strong)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {t('publish.aiAttribution')}
            </span>
          </div>
        </div>

        {/* Modal footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px 16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 12.5,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              fontWeight: 400,
            }}
            onClick={() => onCancel()}
          >
            {t('publish.saveAndFinishLater')}
          </button>
          <button
            style={{
              height: 34,
              padding: '0 18px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--color-accent)',
              color: 'var(--text-on-accent)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
            onClick={() => onPublish()}
          >
            {t('publish.title')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  label,
  rightLabel,
  children,
}: {
  label: string;
  rightLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: 'var(--text-muted-strong)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </span>
        {rightLabel && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {rightLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
