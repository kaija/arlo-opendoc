import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, X } from 'lucide-react';

/**
 * Form primitives for the settings panes.
 *
 * These exist so eleven panes look like one dialog rather than eleven, and so
 * the apply model lives in one place instead of being re-implemented per field:
 *
 *   Toggles, radios and selects APPLY ON CHANGE. There is nothing to mistype.
 *   Text fields COMMIT ON BLUR OR ENTER, and validate first. An invalid value
 *   stays visible with an explanation while the previous value stays in effect,
 *   so a half-typed branch name never becomes the real setting.
 *
 * Everything is inline-styled against the design tokens, matching the rest of
 * this renderer.
 */

// ── Section ────────────────────────────────────────────────────────────────

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          fontFamily: 'var(--font-sans)',
          marginBottom: 14,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </section>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label?: string | undefined;
  hint?: React.ReactNode | undefined;
  error?: string | null | undefined;
  htmlFor?: string | undefined;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label !== undefined && (
        <label
          htmlFor={htmlFor}
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-.01em',
            color: 'var(--text-body)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {label}
        </label>
      )}
      {children}
      {(error != null || hint !== undefined) && (
        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: error != null ? 'var(--color-danger)' : 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
            margin: 0,
          }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

// ── Text input with commit-on-blur ─────────────────────────────────────────

const inputStyle = (invalid: boolean, focused: boolean): React.CSSProperties => ({
  width: '100%',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  color: 'var(--text-body)',
  background: 'var(--surface-card)',
  padding: '9px 12px',
  border: `1px solid ${
    invalid
      ? 'var(--color-danger)'
      : focused
        ? 'var(--color-accent)'
        : 'var(--border-strong)'
  }`,
  borderRadius: 8,
  outline: 'none',
  boxShadow: focused
    ? `0 0 0 3px ${invalid ? 'var(--color-danger-surface)' : 'var(--color-accent-a12)'}`
    : 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
});

export interface TextFieldProps {
  id: string;
  label?: string | undefined;
  hint?: React.ReactNode | undefined;
  /** The committed value currently in effect. */
  value: string;
  placeholder?: string | undefined;
  monospace?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Return an error message to reject the value, or null to accept it. */
  validate?: ((candidate: string) => string | null) | undefined;
  onCommit: (value: string) => void;
}

export function TextField({
  id,
  label,
  hint,
  value,
  placeholder,
  monospace = false,
  disabled = false,
  validate,
  onCommit,
}: TextFieldProps): React.ReactElement {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState(value);
  const [error, setError] = React.useState<string | null>(null);
  const [focused, setFocused] = React.useState(false);

  // Adopt external changes (a reset, or another pane writing the same value)
  // but never while the user is mid-edit.
  React.useEffect(() => {
    if (!focused) {
      setDraft(value);
      setError(null);
    }
  }, [value, focused]);

  function commit(): void {
    if (draft === value) {
      setError(null);
      return;
    }
    const message = validate?.(draft) ?? null;
    if (message !== null) {
      setError(message);
      return;
    }
    setError(null);
    onCommit(draft);
  }

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <input
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            // Abandon the edit rather than closing the dialog.
            e.stopPropagation();
            setDraft(value);
            setError(null);
          }
        }}
        style={{
          ...inputStyle(error != null, focused),
          ...(monospace ? { fontFamily: 'var(--font-mono)', fontSize: 12 } : {}),
          ...(disabled
            ? { background: 'var(--surface-section)', color: 'var(--text-faint)', cursor: 'not-allowed' }
            : {}),
        }}
      />
      {error != null && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
            margin: 0,
          }}
        >
          {t('settings.fields.stillUsing')}{' '}
          <span style={{ fontFamily: 'var(--font-mono)' }}>{value}</span>
        </p>
      )}
    </Field>
  );
}

// ── Number field ───────────────────────────────────────────────────────────

export function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  suffix,
  onCommit,
}: {
  id: string;
  label?: string | undefined;
  hint?: React.ReactNode | undefined;
  value: number;
  min: number;
  max: number;
  suffix?: string | undefined;
  onCommit: (value: number) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ width: 120 }}>
        <TextField
          id={id}
          value={String(value)}
          label={label}
          hint={hint}
          validate={(candidate) => {
            const n = Number(candidate);
            if (!Number.isInteger(n)) return t('settings.fields.mustBeWholeNumber');
            if (n < min || n > max) return t('settings.fields.mustBeBetween', { min, max });
            return null;
          }}
          onCommit={(v) => onCommit(Number(v))}
        />
      </div>
      {suffix !== undefined && (
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-sans)',
            paddingBottom: 10,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────

export function Toggle({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode | undefined;
  checked: boolean;
  disabled?: boolean | undefined;
  onChange: (next: boolean) => void;
}): React.ReactElement {
  return (
    <div>
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 11,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          style={{
            flex: 'none',
            width: 38,
            height: 22,
            padding: 3,
            marginTop: 1,
            background: checked ? 'var(--color-accent)' : 'var(--surface-sunken)',
            border: `1px solid ${checked ? 'var(--color-accent)' : 'var(--border-strong)'}`,
            borderRadius: 999,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'background 150ms ease, border-color 150ms ease',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: checked ? 'var(--text-on-accent)' : 'var(--surface-card)',
              boxShadow: 'var(--shadow-sm)',
              transform: `translateX(${checked ? 16 : 0}px)`,
              transition: 'transform 150ms ease, background 150ms ease',
            }}
          />
        </button>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-body)',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.45,
            }}
          >
            {label}
          </span>
          {hint !== undefined && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.5,
              }}
            >
              {hint}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

// ── Radio group ────────────────────────────────────────────────────────────

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  hint?: React.ReactNode | undefined;
  /** Rendered to the right of the label — e.g. a model id or a warning badge. */
  trailing?: React.ReactNode;
}

export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string | undefined;
  value: T;
  options: RadioOption<T>[];
  onChange: (next: T) => void;
}): React.ReactElement {
  return (
    <Field label={label}>
      <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <label
              key={opt.value}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 11, cursor: 'pointer' }}
            >
              <input
                type="radio"
                checked={selected}
                onChange={() => onChange(opt.value)}
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
              />
              <span
                aria-hidden
                style={{
                  flex: 'none',
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  borderRadius: 999,
                  border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--border-input-hover)'}`,
                  background: selected ? 'var(--color-accent)' : 'var(--surface-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 150ms ease, border-color 150ms ease',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--text-on-accent)',
                    opacity: selected ? 1 : 0,
                    transition: 'opacity 150ms ease',
                  }}
                />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: 'var(--text-body)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {opt.label}
                  {opt.trailing}
                </span>
                {opt.hint !== undefined && (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-faint)',
                      fontFamily: 'var(--font-sans)',
                      lineHeight: 1.5,
                    }}
                  >
                    {opt.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────

export function Select<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  disabled = false,
  onChange,
}: {
  id: string;
  label?: string | undefined;
  hint?: React.ReactNode | undefined;
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean | undefined;
  onChange: (next: T) => void;
}): React.ReactElement {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          style={{
            ...inputStyle(false, false),
            appearance: 'none',
            paddingRight: 34,
            cursor: disabled ? 'not-allowed' : 'pointer',
            ...(disabled
              ? { background: 'var(--surface-section)', color: 'var(--text-faint)' }
              : {}),
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          style={{ position: 'absolute', right: 12, color: 'var(--text-faint)', pointerEvents: 'none' }}
        />
      </div>
    </Field>
  );
}

// ── Tag list (editable string array) ───────────────────────────────────────

export function TagList({
  label,
  hint,
  values,
  placeholder,
  onChange,
}: {
  label?: string | undefined;
  hint?: React.ReactNode | undefined;
  values: string[];
  placeholder?: string | undefined;
  onChange: (next: string[]) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  function add(): void {
    const candidate = draft.trim();
    if (candidate === '') return;
    if (values.includes(candidate)) {
      setError(t('settings.fields.patternAlreadyExcluded'));
      return;
    }
    setError(null);
    setDraft('');
    onChange([...values, candidate]);
  }

  return (
    <Field label={label} error={error} hint={hint}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 4 }}>
        {values.map((v) => (
          <span
            key={v}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px 4px 10px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted-strong)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border)',
              borderRadius: 999,
            }}
          >
            {v}
            <button
              type="button"
              aria-label={t('settings.fields.stopExcluding', { value: v })}
              onClick={() => onChange(values.filter((x) => x !== v))}
              style={{
                display: 'flex',
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--text-faint)',
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-sans)' }}>
            {t('settings.fields.nothingExcluded')}
          </span>
        )}
      </div>
      <input
        type="text"
        value={draft}
        placeholder={placeholder ?? t('settings.fields.addPattern')}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        style={{ ...inputStyle(error != null, false), fontFamily: 'var(--font-mono)', fontSize: 12 }}
      />
    </Field>
  );
}

// ── Slider ─────────────────────────────────────────────────────────────────

export function Slider({
  id,
  label,
  hint,
  value,
  min,
  max,
  format,
  disabled = false,
  onChange,
}: {
  id: string;
  label?: string | undefined;
  hint?: React.ReactNode | undefined;
  value: number;
  min: number;
  max: number;
  format: (v: number) => string;
  disabled?: boolean | undefined;
  onChange: (next: number) => void;
}): React.ReactElement {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: disabled ? 0.55 : 1 }}
      >
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            flex: 1,
            accentColor: 'var(--color-accent)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        />
        <span
          style={{
            minWidth: 52,
            textAlign: 'right',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          {format(value)}
        </span>
      </div>
    </Field>
  );
}

// ── Button ─────────────────────────────────────────────────────────────────

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  busy = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean | undefined;
  busy?: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const palette: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-accent)', color: 'var(--text-on-accent)', border: '1px solid var(--color-accent)' },
    secondary: { background: 'var(--surface-card)', color: 'var(--text-body)', border: '1px solid var(--border-strong)' },
    danger: { background: 'var(--surface-card)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        ...palette[variant],
        padding: '7px 14px',
        fontSize: 12.5,
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        borderRadius: 999,
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 150ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? t('settings.fields.working') : children}
    </button>
  );
}

/**
 * Marks a setting whose value is stored and will be honoured, but whose
 * underlying feature does not exist in the app yet.
 *
 * The alternative — hiding the control until its feature lands — would leave
 * the dialog silently incomplete, and the alternative to THAT is a control
 * that looks live and does nothing. Saying so plainly is the only honest
 * option of the three.
 */
export function PendingBadge({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: 'var(--text-faint)',
        fontFamily: 'var(--font-sans)',
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        padding: '2px 9px',
        marginTop: 6,
      }}
    >
      {children}
    </span>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────

export function StatusLine({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'danger' | 'muted';
  children: React.ReactNode;
}): React.ReactElement {
  const color =
    tone === 'success'
      ? 'var(--color-success)'
      : tone === 'warning'
        ? 'var(--color-warning)'
        : tone === 'danger'
          ? 'var(--color-danger)'
          : 'var(--text-faint)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12,
        color,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {tone === 'success' ? (
        <Check size={13} />
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      )}
      {children}
    </span>
  );
}

// ── Read-only value row ────────────────────────────────────────────────────

export function ReadOnlyRow({
  label,
  value,
  hint,
  monospace = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode | undefined;
  monospace?: boolean | undefined;
}): React.ReactElement {
  return (
    <Field label={label} hint={hint}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-body)',
          fontFamily: monospace ? 'var(--font-mono)' : 'var(--font-sans)',
          padding: '9px 12px',
          background: 'var(--surface-section)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          wordBreak: 'break-all',
        }}
      >
        {value}
      </div>
    </Field>
  );
}
